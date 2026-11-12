<div align="center">

<img src="assets/banner.svg" width="100%" alt="dsh-session-delete" />

<h1>dsh-session-delete</h1>

<p>
  <b>给 DSH 的会话列表补一个「真删除」按钮</b><br/>
  <sub>宿主 registry 遗忘 → 清理正文与投影缓存 → 广播移除事件 → 看门狗复核</sub>
</p>

<!-- 发布后把 YG 换成你自己的 GitHub 用户名（一共 4 处，含文末 Star History） -->
<p>
  <a href="https://github.com/xffwlkjgzs88/dsh-session-delete/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/YG/dsh-session-delete?style=flat-square&label=Stars&color=2f81f7&logo=github&logoColor=white"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-3fb950?style=flat-square"></a>
  <a href="#"><img alt="Awesome" src="https://img.shields.io/badge/awesome-DSH%20plugin-ff6b6b?style=flat-square"></a>
  <a href="#"><img alt="Hub" src="https://img.shields.io/badge/Hub-dsh--plugin-6e7681?style=flat-square"></a>
  <a href="#兼容性"><img alt="DSH" src="https://img.shields.io/badge/dsh-0.2.x-8b5cf6?style=flat-square"></a>
  <a href="#兼容性"><img alt="Node" src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=nodedotjs&logoColor=white"></a>
  <a href="#"><img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ESM-f7df1e?style=flat-square&logo=javascript&logoColor=black"></a>
</p>

<p>
  <a href="README.en.md">English</a> · <b>简体中文</b>
</p>

</div>

---

> **一句话**：在 DSH 侧栏里删掉一条会话，重启后它又自己长回来了 —— 这个插件把它**真的**删掉。

<br/>

<img src="assets/preview.svg" width="100%" alt="删除确认对话框（界面示意图）" />

<br/>

## 目录

- [为什么需要它](#为什么需要它)
- [特性](#特性)
- [安装](#安装)
- [使用](#使用)
- [HTTP 接口](#http-接口)
- [工作原理](#工作原理)
- [兼容性](#兼容性)
- [排错](#排错)
- [卸载](#卸载)
- [目录结构](#目录结构)
- [开发](#开发)
- [注意](#注意)
- [许可](#许可)

---

## 为什么需要它

DSH 的会话列表**没有删除功能**，只有归档。于是很多人（包括我）试过最直觉的办法：直接删磁盘上的会话目录。结果是——删完看着没了，过一会儿、或者重启之后，它又在侧栏里出现。

v0.1 就是这么死的。现场备份留下了完整时间线：

```text
12:48:57  workspace.json: (空)                      ← 插件删成功
12:49:14  workspace.json: 宿主写回，updatedAt 变化   ← 宿主刷盘
12:49:20  workspace.json: d2f98c9f, 3caf4ef1        ← 被删的 id 复活
```

**根因**：宿主的 `WorkspaceRegistry` 在内存里握着权威状态。任何一次别的写操作——新建会话、归档、置顶、改名——都会把内存里的整份状态刷回 `workspace.json`，被删掉的 `sessionId` 于是复活；`SessionStore` 里的活会话更是压根没走过 detach。

> 结论：**不碰宿主的活服务、只改文件，是删不掉的。**

v0.2 照这个结论重写：先让宿主的服务「遗忘」，再动磁盘，最后补一个看门狗复核写回。

---

## 特性

| | 能力 | 说明 |
|:--:|---|---|
| 🗑 | **会话行真删除按钮** | 悬停会话行，`···` 右侧出现 🗑，不占常驻视觉 |
| ⛓ | **registry 级遗忘** | `detachSession` + 清 `archived` / `pinned` 集合，不做文件层面的自欺欺人 |
| 🧊 | **三处一起清** | 会话正文 `sessions/<bucket>/<id>/`、投影缓存 `storages/session_projcache/`、侧栏记录 |
| ⚡ | **即时掉行** | `emit('api-session/removed', id)`，不用等整页刷新 |
| 🐕 | **看门狗复核** | 1.2s / 4s 两次复核，发现复活就地再清一遍 |
| 🧯 | **服务缺席有退路** | 拿不到 `workspaceRegistry` 时退回改 JSON，并留 `workspace.json.bak-<时间戳>` |
| 🪟 | **主题跟随** | 全部走宿主 `--dsw-alias-*` token，浅色/深色都不突兀 |
| 🧹 | **顺手收拾** | 清掉 `dsh.conversation.<id>`、`dsh.sidebar-right.v1.<id>`、`dsh.sessions.current` |
| ⚙️ | **更新入口搬家** | 把侧栏左下角的「新版本」按钮藏起来，在「设置 → 通用」补一条同能力的「版本更新」行 |
| 0️⃣ | **零运行时依赖** | 两个文件，不引入任何第三方包；无常驻定时器，定时器全部 `unref` |

---

## 安装

> 前提：Node.js ≥ 18，DSH ≥ 0.2。**改完必须重启 DSH**，插件在启动时被 bundle 加载。

### 方式 A：从 GitHub 直接装（推荐）

编辑你所用配置档的 `package.json`（web 版用 `web` 档，桌面版用 `desktop` 档，路径为 `~/.dsh/profiles/<profile>/package.json`）：

```jsonc
{
  "dependencies": {
    "dsh-session-delete": "github:YG/dsh-session-delete"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // …原有的 bundle…
        "dsh-session-delete"
      ]
    }
  }
}
```

然后在同一目录执行 `npm install`，重启 DSH。

### 方式 B：本地 tgz

```bash
git clone https://github.com/xffwlkjgzs88/dsh-session-delete.git
cd dsh-session-delete
npm pack                      # 得到 dsh-session-delete-0.2.0.tgz
```

```jsonc
"dependencies": {
  "dsh-session-delete": "file:C:/path/to/dsh-session-delete-0.2.0.tgz"
}
```

### 方式 C：手动拷贝

把仓库整个目录放进 `~/.dsh/profiles/<profile>/node_modules/dsh-session-delete`，再按方式 A 的 `bundles` 那一段加一行。`package.json` 里的 `dsh.bundle.patch` 会自动带上 `cordis.patch.yml`，不需要另外改 `cordis.yml`。

### 验证装上了

重启后打开：

```text
http://127.0.0.1:19387/session-delete/ping
```

```json
{"ok":true,"home":"C:\\Users\\you\\.dsh","version":"0.2.0"}
```

---

## 使用

把鼠标移到左侧任意一条会话上，行尾（`···` 之后）会多出一个 🗑：

1. **点第一次** → 按钮变红显示「确认?」，3.5 秒内有效，过期自动复原；
2. **点第二次** → 真删。不在运行的会话同步删完，页面自动重载；
3. **如果这条会话正在跑**（包括你正打开着的这条）→ 弹确认框，说明会中断当前回合；确认后带 `force: true` 再请求，宿主**先回包再动手**，页面约 0.9s 后重载并落到一条新会话。

浏览器侧同时清掉 `dsh.conversation.<id>`、`dsh.sidebar-right.v1.<id>`，以及指向它的 `dsh.sessions.current`，免得重启后旧视图状态把它「还原」出来。

---

## HTTP 接口

主机侧（host）注册三条同源路由，全部挂在 `/session-delete` 下：

```http
GET  /session-delete/ping
  → 200 {"ok":true,"home":"C:\\Users\\you\\.dsh","version":"0.2.0"}

GET  /session-delete/state
  → 200 {ok, home, running, registry, state:{archivedSessionIds, pinnedSessionIds},
         workspaces:[{id,path,title,sessionIds,rawSessionIds}],
         onDisk:["<bucket>/<session-id>"], cacheIds:[...], live:[...], hasSessionsService}

POST /session-delete/delete
  body {"sessionId":"session-xxxx"}
    → 200 {ok, steps, detached, filesRemoved, freedKB, registry}
  body {"sessionId":"session-xxxx","force":true}
    → 202 {ok, accepted, deferred}      # 随后后台执行
  → 409 {"ok":false,"code":"running","current":true}   # 会话在跑，要显式 force
  → 400 {"ok":false,"error":"invalid sessionId"}
  → 405 {"ok":false,"error":"use POST"}
```

`steps` 是逐条执行记录，形如 `["detach ws_1", "removed"]`、`["session dir", "C:\\...\\"]`；某一步失败会写成 `fail: <原因>`，**不会假装成功**。

`/session-delete/state` 是排错主入口，把「宿主认为有什么」和「磁盘上实际有什么」并排列出来：

```bash
curl http://127.0.0.1:19387/session-delete/state
```

---

## 工作原理

| # | 动作 | 用到的宿主服务 |
|:--:|---|---|
| 1 | 运行中的会话先停活（`archiveSession({ stopActivity: true })`） | `workspaceRegistry` |
| 2 | 从 `SessionStore` detach，触发 `session/disposed` | `sessions` |
| 3 | 每个 workspace 实体 `detachSession(id)`，并清 `archived` / `pinned` 集合 | `workspaceRegistry` |
| 4 | 删 `sessions/<bucket>/<id>/` 与 `storages/session_projcache/sessions/<id>.json` | 文件层 |
| 5 | `emit('api-session/removed', id)` → 浏览器列表立刻掉行 | 事件总线 |
| 6 | 看门狗 1.2s / 4s 复核，若被写回就再遗忘一次 | 定时器（`unref`） |

- **服务可用时绝不双写**：只走 registry，不碰 `workspace.json`，避免和宿主的写链打架；
- **服务缺席时才退路**：直接改 JSON，并保留 `workspace.json.bak-<时间戳>` 备份；
- **删自己**：`force` 请求先回 `202` 再动手，否则删当前会话时那个响应永远发不出去。

---

## 兼容性

| 项目 | 支持情况 |
|---|---|
| DSH web（`dsh web`，配置文件 `web`） | ✅ 已在 0.2.x 上验证 |
| DSH 桌面版（EXE，配置文件 `desktop`） | ✅ 路由与按钮同一套 |
| Node.js | ≥ 18（用了 `node:` 前缀与 `fs.rmSync`） |
| 操作系统 | Windows / macOS / Linux（路径全部走 `join`） |
| 第三方依赖 | 无 |

> 客户端半边会注册到 `sidebar.workspaces.session.row.action` 与 `shell.overlay` 两个座位。如果未来的 DSH 改了座位名，按钮会静默消失（不会报错），届时改 `lib/client.js` 顶部的 `ROW_SLOT` / `OVERLAY_SLOT` 即可。

---

## 排错

| 现象 | 原因 | 处理 |
|---|---|---|
| 行尾没有 🗑 | 插件没进 `bundles`，或没重启 | 检查 `package.json` 的 `bundles`，重启 DSH |
| `/session-delete/ping` 404 | host 半边没加载（缺少 `webServer` 服务） | 确认不是 headless/TUI 场景 |
| 删了重启又回来 | 走的是 v0.1 的纯文件删除 | 升级到 0.2，点删除后看 `/state` 里三处是否都空 |
| 返回 409 `running` | 会话正在运行，属于预期行为 | 在弹窗里确认「强制删除」 |
| 删当前会话后页面空白 | 正在重载 | 约 0.9s 自动重载并落到新会话 |
| `freedKB` 是 0 | 目录本来就不存在（可能是投影缓存残留） | 看 `steps` 里每一步的实际返回 |

---

## 卸载

1. 从 `package.json` 的 `bundles` 里删掉 `dsh-session-delete`；
2. 从 `dependencies` 里删掉对应那一行；
3. 删除 `node_modules/dsh-session-delete`；
4. 重启 DSH。

已删的会话不会回来（这正是它的目的）。

---

## 目录结构

```text
dsh-session-delete/
├── lib/
│   ├── index.js          # host 半边：三条路由 + registry 遗忘 + 文件清理 + 看门狗
│   └── client.js         # client 半边：行内按钮、确认对话框、设置里的更新行
├── cordis.patch.yml      # bundle patch：往 dsh 的插件树里插一行
├── assets/
│   ├── banner.svg
│   └── preview.svg
├── docs/
│   ├── internals.md      # 删除时序与根因分析
│   └── api.md            # 接口细节与 curl 示例
├── test/
│   └── smoke.test.mjs    # node:test 冒烟测试
├── package.json
├── LICENSE
└── README.md
```

---

## 开发

```bash
npm run lint        # node --check 两个 JS 文件
npm test            # node:test 冒烟测试（导出了什么、注册了哪三条路由）
npm run pack:check  # 看看 npm 包会装进哪些文件
```

改完直接重启 DSH 就能看到效果；客户端半边约 22 KB，宿主半边约 16 KB，无构建步骤。

调试建议：

```bash
curl http://127.0.0.1:19387/session-delete/state        # 现状对照
curl -X POST http://127.0.0.1:19387/session-delete/delete \
     -H "content-type: application/json" \
     -d "{\"sessionId\":\"session-xxxx\"}"               # 看 steps 逐步结果
```

---

## 注意

- **删了就是删了**：没有回收站，也没有软删除。
- **强制删除会立刻中断**那条会话正在跑的回合；如果删的是当前会话，你眼前这一轮会断。
- **不要把 DSH 的 web 端口暴露到公网**：这三条路由是同源 HTTP、无鉴权。
- 别在会话写入过程中高频并发删除同一个 id，宿主那边没有为这个场景做幂等。

---

## 许可

[MIT](LICENSE) © YG

如果它帮你省下了「手动删目录 + 重启 + 又回来」的那几个来回，点个 ⭐ 就够了。

<div align="center">
  <a href="https://star-history.com/#xffwlkjgzs88/dsh-session-delete&Date">
    <img src="https://api.star-history.com/svg?repos=xffwlkjgzs88/dsh-session-delete&type=Date" alt="Star History Chart" width="640" />
  </a>
</div>
