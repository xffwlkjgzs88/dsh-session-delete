# HTTP 接口

四条路由都是同源、无鉴权、`no-store`。前缀固定 `/session-delete`。

约定：

- `sessionId` 必须匹配 `^[A-Za-z0-9._:-]{4,120}$`，否则 `400`；
- `POST /delete` 的请求体上限 8KB，超了直接断开；
- 所有响应 `content-type: application/json; charset=utf-8`；
- 任何一步失败都会写进 `steps`，格式 `fail: <原因>`，不会静默吞掉。

---

## `GET /session-delete/ping`

探活 + 确认插件挂的是哪个 home。

```bash
curl http://127.0.0.1:19387/session-delete/ping
```

```json
{ "ok": true, "home": "C:\\Users\\you\\.dsh", "version": "0.3.1" }
```

`home` 优先取环境变量 `DSH_HOME`，否则 `~/.dsh`。

---

## `GET /session-delete/size?sessionId=…`

弹窗打开时用它算「这条会话占多少」，只读，不动任何东西。

```bash
curl "http://127.0.0.1:19387/session-delete/size?sessionId=session-9f0c"
```

```json
{ "ok": true, "id": "session-9f0c", "bytes": 49315840, "kb": 48160.0, "dirs": 1, "cache": true }
```

`dirs` 是命中几个会话目录（正常是 1），`cache` 表示投影缓存在不在。目录不存在时返回 `bytes: 0`，不报错 —— 前端拿不到就干脆不显示这一行。

---

## `GET /session-delete/state`

诊断主入口。把「宿主认为有什么」和「磁盘上实际有什么」并排列出来。

```bash
curl http://127.0.0.1:19387/session-delete/state
```

```jsonc
{
  "ok": true,
  "home": "C:\\Users\\you\\.dsh",
  "running": "session-32ad…",          // 处理这次请求的会话（DSH_SESSION_ID）
  "registry": "service",               // service | file-only | absent
  "state": {
    "archivedSessionIds": [],
    "pinnedSessionIds": []
  },
  "workspaces": [
    {
      "id": "ws_1a2b",
      "path": "C:\\Users\\you\\proj",
      "title": "默认工作区",
      "sessionIds": ["session-32ad…"], // 视图层（可能被 cwd 过滤）
      "rawSessionIds": ["session-32ad…", "session-9f0c…"]  // 记录层原始值
    }
  ],
  "onDisk": ["2026-11/session-32ad…"],  // sessions/<bucket>/<id>
  "cacheIds": ["session-32ad…"],         // 投影缓存里存在的 id
  "live": ["session-32ad…"],             // SessionStore 里活着（detach 前）
  "hasSessionsService": true
}
```

排错对照方法：

| 检查 | 期望 |
|---|---|
| 删完之后 `onDisk` | 不含被删 id |
| 删完之后 `cacheIds` | 不含被删 id |
| 删完之后 `workspaces[].sessionIds` | 不含被删 id |
| `registry: "file-only"` | 宿主服务没拿到，走的是改 JSON 的退路 |

---

## `POST /session-delete/delete`

### 正常删除（会话没在跑）

```bash
curl -X POST http://127.0.0.1:19387/session-delete/delete \
  -H "content-type: application/json" \
  -d '{"sessionId":"session-9f0c"}'
```

```jsonc
{
  "ok": true,
  "id": "session-9f0c",
  "steps": [
    ["detach ws_1a2b", "removed"],
    ["archive/pin set", "cleared"],
    ["session dir", "C:\\Users\\you\\.dsh\\sessions\\2026-11\\session-9f0c"],
    ["projection cache", "C:\\Users\\you\\.dsh\\storages\\session_projcache\\sessions\\session-9f0c.json"],
    ["emit api-session/removed", "ok"]
  ],
  "detached": ["ws_1a2b"],
  "filesRemoved": 2,
  "freedKB": 148.3,
  "registry": "service",
  "forced": false
}
```

### 会话在跑

不带 `force` 时拒绝硬删：

```http
HTTP/1.1 409 Conflict
{"ok":false,"code":"running","id":"session-9f0c","current":true,
 "error":"会话正在运行：确认强制删除（会中断它）后带 force:true 再来"}
```

`current: true` 表示删的就是你当前打开的那条。

### 强制删除

```bash
curl -X POST http://127.0.0.1:19387/session-delete/delete \
  -H "content-type: application/json" \
  -d '{"sessionId":"session-9f0c","force":true}'
```

```http
HTTP/1.1 202 Accepted
{"ok":true,"accepted":true,"deferred":true,"id":"session-9f0c","forced":true}
```

响应在真正动手之前发出（否则删自己时这个响应发不出去），实际执行在 60ms 后开始，结果只写日志，不再回包。之后看 `GET /state` 验证。

---

## 状态码一览

| 状态码 | 含义 | 下一步 |
|---|---|---|
| `200` | 删除完成，`steps` 里是逐步结果 | 检查 `steps` 是否有 `fail:` |
| `202` | 已接受，后台执行中 | 等 ~1s，查 `/state` |
| `400` | `sessionId` 不合法或 JSON 解析失败 | 修请求体 |
| `405` | 非 POST | 用 POST |
| `409` | 会话在跑，未带 `force` | 确认后带 `force: true` |
| `500` | 未预期异常，`error` 里有原因 | 看宿主日志 |

---

## 客户端侧行为

前端（`lib/client.js`）在拿到结果后：

| 结果 | 行为 |
|---|---|
| `200 ok` | 清 localStorage 里的会话相关 key，立即 `location.reload()` |
| `202` | 清 key，900ms 后 reload（给宿主留出收尾时间） |
| `409 code=running` | 不关弹窗，切成「强制删除」确认态 |
| 其它 | 弹窗内展示 `删除失败：<error>`，可重试 |

清理的 key：`dsh.conversation.<id>`、`dsh.sidebar-right.v1.<id>`、以及包含该 id 的 `dsh.sessions.current`；另外会扫一遍 localStorage，把任何 key 名里含该 id 的条目一并删掉。
