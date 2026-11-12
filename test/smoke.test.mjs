import { test } from 'node:test'
import assert from 'node:assert/strict'

import { name, inject, apply } from '../lib/index.js'

function fakeCtx() {
  const routes = []
  const events = []
  return {
    routes,
    events,
    webServer: {
      register(route) {
        routes.push(route)
        return () => {}
      },
    },
    emit(event, payload) { events.push([event, payload]) },
  }
}

test('导出名与依赖声明稳定', () => {
  assert.equal(name, 'dsh-session-delete')
  assert.deepEqual(inject, ['webServer'])
})

test('注册三条路由，路径不重复', () => {
  const ctx = fakeCtx()
  apply(ctx)
  const paths = ctx.routes.map((route) => route.path).sort()
  assert.deepEqual(paths, [
    '/session-delete/delete',
    '/session-delete/ping',
    '/session-delete/state',
  ])
  assert.equal(new Set(paths).size, paths.length)
})

test('缺少 webServer 时安静退出', () => {
  assert.doesNotThrow(() => apply({}))
  assert.doesNotThrow(() => apply({ webServer: undefined }))
})

test('ping 处理器返回版本与 home', () => {
  const ctx = fakeCtx()
  apply(ctx)
  const ping = ctx.routes.find((route) => route.path === '/session-delete/ping')

  const captured = { headers: {} }
  const res = {
    setHeader(key, value) { captured.headers[key] = value },
    end(body) { captured.body = body },
  }
  ping.handler({ method: 'GET' }, res)

  const payload = JSON.parse(captured.body)
  assert.equal(payload.ok, true)
  assert.equal(payload.version, '0.2.0')
  assert.equal(typeof payload.home, 'string')
  assert.match(captured.headers['content-type'], /application\/json/)
})
