# 内部实现：为什么「删文件」删不掉会话

本文记录 v0.1 失败的完整原因，以及 v0.2 的删除时序设计。写给要改这个插件、或者要写类似「宿主状态 + 磁盘状态」双写插件的人。

---

## 1. 两份状态

DSH 的会话在磁盘和内存里各有一份，而**内存那份是权威的**：

| 位置 | 内容 | 谁写 |
|---|---|---|
| `~/.dsh/sessions/<bucket>/<session-id>/` | 会话正文（消息、附件引用） | `SessionStore` 持久化 |
| `~/.dsh/storages/session_projcache/sessions/<id>.json` | 投影缓存（侧栏列表渲染用的瘦身视图） | 投影层 |
| `~/.dsh/storages/workspace.json` | 侧栏状态：每个 workspace 的 `sessionIds`、全局 `archivedSessionIds` / `pinnedSessionIds` | `WorkspaceRegistry` 刷盘 |

`WorkspaceRegistry` 启动时从 `workspace.json` 读一次，然后在内存里持有整份状态对象。之后**任何**写操作（新建会话、归档、置顶、改名、拖拽排序）都会触发一次整份刷盘：

```text
registry 内存状态  ──(任意写操作)──►  workspace.json（整体覆盖）
```

所以「先删磁盘」的方案一定会输：你删完之后，宿主只要动一次，就会用内存里那份**还包含被删 id** 的状态覆盖回去。

---

## 2. v0.1 的现场证据

备份目录里留下了三份连续的 `workspace.json`：

```text
12:48:57  workspace.json: (空)                      ← 插件删成功
12:49:14  workspace.json: 宿主写回，updatedAt 变化   ← 宿主刷盘
12:49:20  workspace.json: d2f98c9f, 3caf4ef1        ← 被删的 id 复活
```

对应宿主的写链：插件删掉 id → 某个后台动作（会话心跳 / 列表刷新触发的状态更新）→ `setState` → 整份落盘 → id 回来。

`SessionStore` 那边更直接：活着的会话压根没走过 `detach`，`session/disposed` 没发，列表下次从 store 重建时自然又把它带出来。

---

## 3. v0.2 的顺序

顺序本身是有讲究的，不能随便换：

```text
1. archiveSession({ stopActivity: true })     # 停活：先让它别继续写
2. sessions.store.get(id)?.detach()           # 触发 session/disposed
3. registry.list() → 每个实体 detachSession(id)
4. registry.requireState() → 清 archived / pinned
5. 删 sessions/<bucket>/<id>/ 与投影缓存
6. emit('api-session/removed', id)
7. 看门狗 1.2s / 4s 复核
```

几个关键点：

### 3.1 先停活，再删盘

运行中的会话仍在持久化（流式消息、工具结果）。如果先删目录，宿主的下一段写入会把目录**重新建出来**，你删了个寂寞。`stopActivity` + `detach` 之后等 300ms，让最后一段持久化落完。

### 3.2 无条件 detach

不要先判断 `workspace.sessionIds` 里有没有这个 id 再决定要不要 detach。读取时 `sessionIds` 可能被 cwd 过滤过（记录里握着、但视图里看不到），一旦跳过就会出现「明明在 registry 里但没被清掉」。所以对每个 workspace 实体**无条件**调用 `detachSession`，把 `held` 只作为日志信息。

### 3.3 服务可用就不双写

`workspaceRegistry` 存在时，**只**通过服务改状态，绝不额外写 `workspace.json`。两个写者同时写同一份 JSON，谁后落盘谁说了算，冲突不可预测。

只有服务缺席（换了宿主版本、注册名变了、headless 场景）时，才退回直接改文件，并保留 `workspace.json.bak-<时间戳>`，让人能手工回滚。

### 3.4 删自己要先回包

删当前会话时，`performDelete` 会 detach 掉正在处理这个 HTTP 请求的会话语境。如果同步执行，响应永远发不出去，浏览器只会看到请求 pending 到超时。

处理方式是：`force` 且会话在跑时，先 `202 {accepted: true, deferred: true}`，60ms 后再后台执行。前端拿到 202 后等 900ms 再 `location.reload()`，落在一条新会话上。

### 3.5 看门狗的必要性

即使顺序全对，宿主仍可能在删除后的一小段时间里用一份**删除前**的内存快照刷盘（典型场景：删除瞬间正好有一个写操作在排队）。

看门狗就是兜这个窗口：

```js
for (const delay of [1200, 4000]) {
  setTimeout(check, delay).unref()   // 不阻止进程退出
}
```

复核内容有三项：`sessions/` 下还有没有这个目录、投影缓存还在不在、registry 的 `sessionIds` 里还在不在。任意一项为真 → 再执行一次遗忘 + 删文件 + 广播。两次之后不再纠缠。

---

## 4. 已知边界

- **不可恢复**：没有软删除，删掉的正文不会进任何回收站。
- **运行中会话会被打断**：`force` 路径会停掉它正在跑的回合。
- **并发不幂等**：同一 id 高频并发删除，宿主那边没有为这个场景做保护；插件自身也不做去重。
- **座位名耦合**：客户端按钮挂在 `sidebar.workspaces.session.row.action`，弹窗挂在 `shell.overlay`。宿主改名后按钮会静默消失（`ctx.slots.inject` 不抛错），需要同步改 `lib/client.js` 顶部常量。
- **同源无鉴权**：路由不加 token。DSH 的 web 端口本来就只监听 loopback，别把它暴露出去。
