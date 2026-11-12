/**
 * dsh-session-delete — host 半边（v0.3.2）
 *
 * 为什么 v0.1 删不掉：
 *   旧版只动磁盘（会话正文 / 投影缓存 / workspace.json）。但宿主的
 *   WorkspaceRegistry 在内存里握着权威状态，任何一次其它写操作（新建会话、
 *   归档、改名）都会把内存状态整体刷回 workspace.json，被删掉的 sessionId
 *   于是复活；重启后 sidebar 又从 registry 里把它读回来。
 *
 * v0.2 的做法：先让宿主的活服务遗忘，再删文件，最后补一个看门狗复核。
 *
 *   1) ctx.get('workspaceRegistry')  → 每个 workspace 实体 detachSession(id)
 *                                      并把 id 从 archived / pinned 集合里剔除
 *   2) 运行中的会话（force）：archiveSession({stopActivity:true}) 停活，
 *                              再从 SessionStore 里 detach（触发 session/disposed）
 *   3) 删磁盘：sessions/<bucket>/<id>/ 与 storages/session_projcache/sessions/<id>.json
 *   4) emit('api-session/removed', id) → 浏览器侧列表立刻掉行，不用等重载
 *   5) 看门狗：1.2s / 4s 后复核，若被写回就再遗忘一次
 *
 * 只有拿不到 registry 服务时才退回直接改 workspace.json（并保留 .bak 备份）。
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export const name = 'dsh-session-delete'
export const inject = ['webServer']

const VERSION = '0.3.4'
const ROUTE = '/session-delete'
const ID_RE = /^[A-Za-z0-9._:-]{4,120}$/
const MAX_BODY = 8 * 1024
const WATCHDOG_MS = [1200, 4000]

function dshHome() {
  const env = process.env.DSH_HOME
  return env && env.trim() ? env.trim() : join(homedir(), '.dsh')
}

function paths(home) {
  return {
    sessionsRoot: join(home, 'sessions'),
    cacheRoot: join(home, 'storages', 'session_projcache', 'sessions'),
    registryFile: join(home, 'storages', 'workspace.json'),
  }
}

function sizeOf(target) {
  let total = 0
  try {
    const st = statSync(target)
    if (!st.isDirectory()) return st.size
    for (const entry of readdirSync(target)) total += sizeOf(join(target, entry))
  } catch { /* 目标不存在按 0 算 */ }
  return total
}

/** sessions/<bucket>/<id>（也容忍 <bucket>/<中间层>/<id>，但最多三层，避免全盘扫）。 */
function findSessionDirs(root, sessionId) {
  const found = []
  if (!existsSync(root)) return found
  const walk = (dir, depth) => {
    if (depth > 3) return
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const full = join(dir, entry.name)
      if (entry.name === sessionId) { found.push(full); continue }
      walk(full, depth + 1)
    }
  }
  walk(root, 1)
  return found
}

function sleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    if (typeof timer.unref === 'function') timer.unref()
  })
}

function service(ctx, key) {
  try {
    const found = typeof ctx.get === 'function' ? ctx.get(key) : ctx[key]
    return found ?? null
  } catch {
    return null
  }
}

function isLive(sessions, sessionId) {
  try {
    return Boolean(sessions?.get?.(sessionId))
  } catch {
    return false
  }
}

/**
 * 让宿主的活 registry 忘掉这条会话：每个 workspace 实体 detach + 清 archive/pin 集合。
 * 返回每一步的结果，失败也如实汇报，不假装成功。
 */
async function forgetInRegistry(registry, sessionId, report) {
  if (!registry) { report.registry = 'absent'; return false }
  report.registry = 'service'

  let workspaces = []
  try { workspaces = registry.list() ?? [] } catch (error) {
    report.steps.push(['registry.list', `fail: ${String(error?.message ?? error)}`])
    return false
  }

  for (const workspace of workspaces) {
    const id = workspace?.id ?? workspace?.workspaceId
    try {
      let held = false
      try { held = Array.isArray(workspace.sessionIds) && workspace.sessionIds.includes(sessionId) } catch { held = false }
      // 记录里可能还握着（读取时被 cwd 过滤掉的也算），所以无条件 detach
      await workspace.detachSession(sessionId)
      report.detached.push(id ?? '(unknown)')
      report.steps.push(['detach ' + String(id), held ? 'removed' : 'noop'])
    } catch (error) {
      report.steps.push(['detach ' + String(id), `fail: ${String(error?.message ?? error)}`])
    }
  }

  try {
    const state = registry.requireState?.()
    if (state) {
      const archived = Array.isArray(state.archivedSessionIds) ? state.archivedSessionIds : []
      const pinned = Array.isArray(state.pinnedSessionIds) ? state.pinnedSessionIds : []
      if (archived.includes(sessionId) || pinned.includes(sessionId)) {
        await registry.setState({
          ...state,
          archivedSessionIds: archived.filter((id) => id !== sessionId),
          pinnedSessionIds: pinned.filter((id) => id !== sessionId),
        })
        report.steps.push(['archive/pin set', 'cleared'])
      }
    }
  } catch (error) {
    report.steps.push(['archive/pin set', `fail: ${String(error?.message ?? error)}`])
  }

  return true
}

/** 服务缺席时的退路：直接改 JSON（会备份）。 */
function forgetInFile(registryFile, sessionId, report) {
  if (!existsSync(registryFile)) { report.registryFile = 'absent'; return false }
  try {
    const registry = JSON.parse(readFileSync(registryFile, 'utf8'))
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    copyFileSync(registryFile, `${registryFile}.bak-${stamp}`)
    const global = registry?.global ?? {}
    global.archivedSessionIds = (global.archivedSessionIds ?? []).filter((id) => id !== sessionId)
    global.pinnedSessionIds = (global.pinnedSessionIds ?? []).filter((id) => id !== sessionId)
    registry.global = global
    const workspaces = registry?.tables?.workspaces ?? {}
    for (const key of Object.keys(workspaces)) {
      const record = workspaces[key]
      if (record && Array.isArray(record.sessionIds)) {
        record.sessionIds = record.sessionIds.filter((id) => id !== sessionId)
      }
    }
    writeFileSync(registryFile, JSON.stringify(registry, null, 2), 'utf8')
    report.registry = 'file'
    report.steps.push(['workspace.json', 'rewritten'])
    return true
  } catch (error) {
    report.steps.push(['workspace.json', `fail: ${String(error?.message ?? error)}`])
    return false
  }
}

/** 删正文 + 投影缓存；返回回收字节数与命中的路径。 */
function removeFiles(home, sessionId, report) {
  const { sessionsRoot, cacheRoot } = paths(home)
  let freed = 0

  for (const dir of findSessionDirs(sessionsRoot, sessionId)) {
    freed += sizeOf(dir)
    try {
      rmSync(dir, { recursive: true, force: true })
      report.steps.push(['session dir', dir])
      report.filesRemoved += 1
    } catch (error) {
      report.steps.push(['session dir', `fail: ${String(error?.message ?? error)}`])
    }
  }

  const cacheFile = join(cacheRoot, `${sessionId}.json`)
  if (existsSync(cacheFile)) {
    freed += sizeOf(cacheFile)
    try {
      rmSync(cacheFile, { force: true })
      report.steps.push(['projection cache', cacheFile])
      report.filesRemoved += 1
    } catch (error) {
      report.steps.push(['projection cache', `fail: ${String(error?.message ?? error)}`])
    }
  }

  report.freedKB = Math.round((freed / 1024) * 10) / 10
  return freed
}

function stillPresent(home, registry, sessionId) {
  const { sessionsRoot, cacheRoot } = paths(home)
  const { registryFile } = paths(home)
  const dirs = findSessionDirs(sessionsRoot, sessionId)
  const cache = existsSync(join(cacheRoot, `${sessionId}.json`))
  let inRegistry = false
  try {
    const workspaces = registry?.list?.() ?? []
    inRegistry = workspaces.some((workspace) => {
      try { return Array.isArray(workspace.sessionIds) && workspace.sessionIds.includes(sessionId) } catch { return false }
    })
  } catch {
    if (existsSync(registryFile)) {
      try { inRegistry = readFileSync(registryFile, 'utf8').includes(sessionId) } catch { inRegistry = false }
    }
  }
  return { dirs: dirs.length, cache, inRegistry }
}

function json(res, code, payload) {
  try {
    res.statusCode = code
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify(payload))
  } catch { /* 连接已断 */ }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function newReport(sessionId) {
  return { ok: true, id: sessionId, steps: [], detached: [], filesRemoved: 0, freedKB: 0, registry: 'absent', forced: false }
}

/**
 * 真正的删除动作。force=true 时会先停掉运行中的会话（这一步可能把当前回合打断，
 * 所以 HTTP 响应在调用它之前就已经发出去了）。
 */
async function performDelete(ctx, sessionId, force) {
  const home = dshHome()
  const registry = service(ctx, 'workspaceRegistry')
  const sessions = service(ctx, 'sessions')
  const report = newReport(sessionId)
  report.forced = force

  if (force) {
    try {
      if (isLive(sessions, sessionId)) {
        try {
          await registry?.archiveSession?.(sessionId, { stopActivity: true })
          report.steps.push(['stop activity', 'requested'])
        } catch (error) {
          report.steps.push(['stop activity', `skip: ${String(error?.message ?? error)}`])
        }
        try {
          sessions?.store?.get?.(sessionId)?.detach?.()
          report.steps.push(['session store', 'detached'])
        } catch (error) {
          report.steps.push(['session store', `fail: ${String(error?.message ?? error)}`])
        }
        await sleep(300) // 让持久化写完最后一段，再删文件
      }
    } catch { /* 停活失败不阻断删除 */ }
  }

  if (!(await forgetInRegistry(registry, sessionId, report))) {
    forgetInFile(paths(home).registryFile, sessionId, report)
  }

  removeFiles(home, sessionId, report)

  try {
    ctx.emit('api-session/removed', sessionId)
    report.steps.push(['emit api-session/removed', 'ok'])
  } catch (error) {
    report.steps.push(['emit api-session/removed', `fail: ${String(error?.message ?? error)}`])
  }

  // 看门狗：宿主内存若又把 id 写回，这里再遗忘一次，并复核文件是否被重建
  for (const delay of WATCHDOG_MS) {
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const state = stillPresent(home, service(ctx, 'workspaceRegistry'), sessionId)
          if (state.inRegistry || state.dirs > 0 || state.cache) {
            const retry = newReport(sessionId)
            retry.forced = true
            if (!(await forgetInRegistry(service(ctx, 'workspaceRegistry'), sessionId, retry))) {
              forgetInFile(paths(home).registryFile, sessionId, retry)
            }
            removeFiles(home, sessionId, retry)
            ctx.emit?.('api-session/removed', sessionId)
            ctx.logger?.warn?.(`[session-delete] watchdog(${delay}ms) 复核发现复活，已再次清理：${sessionId}`)
          }
        } catch { /* 看门狗不抛 */ }
      })()
    }, delay)
    if (typeof timer.unref === 'function') timer.unref()
  }

  return report
}

async function handleSize(ctx, req, res) {
  const url = new URL(req.url ?? ROUTE, 'http://127.0.0.1')
  const sessionId = String(url.searchParams.get('sessionId') ?? '')
  if (!ID_RE.test(sessionId)) return json(res, 400, { ok: false, error: 'invalid sessionId' })

  const home = dshHome()
  const { sessionsRoot, cacheRoot } = paths(home)

  let bytes = 0
  let dirs = 0
  for (const dir of findSessionDirs(sessionsRoot, sessionId)) {
    bytes += sizeOf(dir)
    dirs += 1
  }
  const cacheFile = join(cacheRoot, `${sessionId}.json`)
  const hasCache = existsSync(cacheFile)
  if (hasCache) bytes += sizeOf(cacheFile)

  return json(res, 200, {
    ok: true,
    id: sessionId,
    bytes,
    kb: Math.round((bytes / 1024) * 10) / 10,
    dirs,
    cache: hasCache,
  })
}

async function handleState(ctx, res) {
  const home = dshHome()
  const { sessionsRoot, cacheRoot, registryFile } = paths(home)
  const registry = service(ctx, 'workspaceRegistry')
  const sessions = service(ctx, 'sessions')

  const workspaces = []
  try {
    for (const workspace of registry?.list?.() ?? []) {
      workspaces.push({
        id: workspace?.id ?? workspace?.workspaceId,
        path: workspace?.record?.path,
        title: workspace?.record?.title,
        sessionIds: [...(workspace?.sessionIds ?? [])],
        rawSessionIds: [...(workspace?.record?.sessionIds ?? [])],
      })
    }
  } catch (error) {
    workspaces.push({ error: String(error?.message ?? error) })
  }

  let state = null
  try {
    const global = registry?.requireState?.()
    if (global) {
      state = {
        archivedSessionIds: [...(global.archivedSessionIds ?? [])],
        pinnedSessionIds: [...(global.pinnedSessionIds ?? [])],
      }
    }
  } catch { state = null }

  const onDisk = []
  if (existsSync(sessionsRoot)) {
    for (const bucket of readdirSync(sessionsRoot, { withFileTypes: true })) {
      if (!bucket.isDirectory()) continue
      let inner = []
      try { inner = readdirSync(join(sessionsRoot, bucket.name), { withFileTypes: true }) } catch { inner = [] }
      for (const entry of inner) {
        if (entry.isDirectory()) onDisk.push(`${bucket.name}/${entry.name}`)
      }
    }
  }

  let cacheIds = []
  if (existsSync(cacheRoot)) {
    try {
      cacheIds = readdirSync(cacheRoot).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5))
    } catch { cacheIds = [] }
  }

  json(res, 200, {
    ok: true,
    home,
    running: process.env.DSH_SESSION_ID ?? null,
    registry: registry ? 'service' : existsSync(registryFile) ? 'file-only' : 'absent',
    state,
    workspaces,
    onDisk,
    cacheIds,
    live: (() => { try { return [...(sessions?.store?.keys?.() ?? [])] } catch { return [] } })(),
    hasSessionsService: Boolean(sessions),
  })
}

async function handleDelete(ctx, req, res) {
  if ((req.method || 'GET').toUpperCase() !== 'POST') return json(res, 405, { ok: false, error: 'use POST' })

  let payload
  try {
    payload = JSON.parse((await readBody(req)) || '{}')
  } catch (error) {
    return json(res, 400, { ok: false, error: `bad json: ${error.message}` })
  }

  const sessionId = String(payload?.sessionId ?? '')
  if (!ID_RE.test(sessionId)) return json(res, 400, { ok: false, error: 'invalid sessionId' })

  const force = payload?.force === true
  const sessions = service(ctx, 'sessions')
  const live = isLive(sessions, sessionId)

  if (live && !force) {
    // 运行中的会话不硬删；让前端显式确认后再带 force 回来
    return json(res, 409, {
      ok: false,
      code: 'running',
      id: sessionId,
      current: process.env.DSH_SESSION_ID === sessionId,
      error: '会话正在运行：确认强制删除（会中断它）后带 force:true 再来',
    })
  }

  if (live && force) {
    // 先回包，再动手：否则删自己的时候这个响应永远发不出去
    json(res, 202, { ok: true, accepted: true, deferred: true, id: sessionId, forced: true })
    setTimeout(() => { void performDelete(ctx, sessionId, true) }, 60)
    return
  }

  const report = await performDelete(ctx, sessionId, false)
  return json(res, 200, report)
}

export function apply(ctx) {
  const webServer = ctx.webServer
  if (!webServer) return

  const disposers = []

  disposers.push(webServer.register({
    kind: 'exact',
    path: `${ROUTE}/ping`,
    handler: (req, res) => json(res, 200, { ok: true, home: dshHome(), version: VERSION }),
  }))

  disposers.push(webServer.register({
    kind: 'exact',
    path: `${ROUTE}/size`,
    handler: (req, res) => {
      handleSize(ctx, req, res).catch((error) => json(res, 500, { ok: false, error: String(error?.message ?? error) }))
    },
  }))

  disposers.push(webServer.register({
    kind: 'exact',
    path: `${ROUTE}/state`,
    handler: (req, res) => {
      handleState(ctx, res).catch((error) => json(res, 500, { ok: false, error: String(error?.message ?? error) }))
    },
  }))

  disposers.push(webServer.register({
    kind: 'exact',
    path: `${ROUTE}/delete`,
    handler: (req, res) => {
      handleDelete(ctx, req, res).catch((error) => json(res, 500, { ok: false, error: String(error?.message ?? error) }))
    },
  }))

  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      for (const dispose of disposers) {
        try { dispose() } catch { /* 已销毁 */ }
      }
    })
  }
}
