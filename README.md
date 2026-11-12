<div align="center">

<img src="assets/banner.svg" width="100%" alt="dsh-session-delete" />

<h1>dsh-session-delete</h1>

<p>
  <b>给 DSH 的会话列表加一个能真删的按钮</b><br/>
  <sub>不是归档，是删掉</sub>
</p>

<p>
  <a href="https://github.com/xffwlkjgzs88/dsh-session-delete/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/xffwlkjgzs88/dsh-session-delete?style=flat-square&label=Stars&color=2f81f7&logo=github&logoColor=white"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-3fb950?style=flat-square"></a>
  <a href="DISCLAIMER.md"><img alt="Disclaimer" src="https://img.shields.io/badge/免责声明-必读-d29922?style=flat-square"></a>
  <a href="https://wpa.qq.com/msgrd?v=3&amp;uin=811588817&amp;site=qq&amp;menu=yes"><img alt="QQ" src="https://img.shields.io/badge/QQ-811588817-12B7F5?style=flat-square&logo=tencentqq&logoColor=white"></a>
</p>

<p>
  <a href="README.en.md">English</a> · <b>简体中文</b>
</p>

<p>
  <sub>
    作者接活：网站 / 小程序搭建部署 · 服务器 · 域名 · 支付接口对接
  </sub>
</p>

</div>

> [!IMPORTANT]
> 装之前知道两件事：
>
> 1. 会话行会多一个垃圾桶，点两次删除（这是主功能）；
> 2. 侧栏左下角的"新版本"按钮会被藏起来，改到「设置 → 通用」里。不想要：Console 执行
>    `localStorage.setItem('dsh.session-delete.hideUpdateBadge', '0')` 刷新即可。
>
> 只有桌面版、且宿主有 `dshDesktop.updates` 才会动；web 版不碰。

## 装

**方法一（推荐）**：在 DSH 里新开一个会话，把下面这句原样发给它。

```text
把 GitHub 上的 xffwlkjgzs88/dsh-session-delete 装到 DSH：profile 的 package.json 加依赖、bundles 加一行，跑 npm install，重启后打开 /session-delete/ping 确认。
```

它自己会找目录、改文件、跑安装。装完重启 DSH 就行，不用更新客户端。

**方法二**：自己改两处。桌面版是 `~/.dsh/profiles/desktop/package.json`，web 版是 `~/.dsh/profiles/web/package.json`。

```jsonc
{
  "dependencies": { "dsh-session-delete": "github:xffwlkjgzs88/dsh-session-delete" },
  "dsh": { "profile": { "bundles": ["…原有的…", "dsh-session-delete"] } }
}
```

同目录 `npm install`，重启。没装 Node 也行，零依赖：把仓库解压成 `node_modules/dsh-session-delete` 丢进去。

**验证**：

```text
http://127.0.0.1:19387/session-delete/ping
{"ok":true,"home":"…","version":"0.3.5"}
```

## 起因

DSH 侧栏只有归档，没有删除。我那串归档列表越堆越长，全是不会再打开的东西，还占着硬盘。

最初我直接去 `~/.dsh/sessions/` 删目录。删完看着没了，过几分钟又冒出来，重启更是原样回来。

查了一晚上才明白：宿主的 `WorkspaceRegistry` 把整份侧栏状态放在内存里，你动磁盘它不知道。它下一次写盘，整份内存状态覆盖回去，被删的 `sessionId` 又回来了。备份里留着证据：

```text
12:48:57  workspace.json: (空)                      插件删成功
12:49:14  workspace.json: 宿主写回，updatedAt 变了   宿主刷盘
12:49:20  workspace.json: d2f98c9f, 3caf4ef1        删掉的 id 又在了
```

所以顺序得反过来：先让宿主忘掉，再删文件，最后盯几秒看会不会被写回。

## 删一条会话时会发生什么

1. 会话在跑就先停活，等 300ms 让最后一段写盘落完；
2. 从 `SessionStore` detach，触发 `session/disposed`；
3. 每个 workspace 实体 `detachSession(id)`，顺手剔掉 archived / pinned 里的残留；
4. 删 `sessions/<bucket>/<id>/` 和投影缓存；
5. `emit('api-session/removed')`，列表立刻掉行；
6. 1.2 秒、4 秒各复核一次，被写回就再清一遍。

拿不到 `workspaceRegistry` 才退回改 `workspace.json`（先存 `.bak`）。服务在就绝不双写。

## 用法

鼠标移到会话行上，`···` 右边出现垃圾桶。点第一次变红问「确认?」，3.5 秒内点第二次才真删。

弹窗里会显示这条会话占多大。正在运行的会话会额外警告"这一轮会被打断"，确认后才动手。

## 界面改动（第二处）

除了删除按钮，插件还动了一个地方：

- 隐藏侧栏左下角那个「新版本」按钮（类名以 `_indicator` 结尾）；
- 在「设置 → 通用 → 当前版本」下面补一行「版本更新」，状态和原生一致；
- 更新逻辑没改，还是走 `globalThis.dshDesktop.updates`；
- 只在桌面版且该桥存在时生效，web 版不碰。

关掉：

```js
localStorage.setItem('dsh.session-delete.hideUpdateBadge', '0')
```

## 接口

四条路由，同源、无鉴权。

```http
GET  /session-delete/ping              → {"ok":true,"home":"…","version":"0.3.5"}
GET  /session-delete/state             → 宿主认为有什么 vs 磁盘上有什么
GET  /session-delete/size?sessionId=…  → 这条会话占多少字节
POST /session-delete/delete            → {"sessionId":"…"} 或 {"sessionId":"…","force":true}
```

`/delete` 返回：`200` 删完（带 `steps`）、`409` 会话在跑要 `force`、`202` 已受理后台执行、`400` id 不合法、`405` 方法不对。

`steps` 里失败会写成 `fail: 原因`，不假装成功。细节见 [docs/api.md](docs/api.md)。

## 兼容性

**只在 DSH 0.2.0-rc.2 桌面版（Windows 11）上真跑过。** 当前仓库版本只做了静态验证（`node --check` + 4 条单测）。

没实测：web 版、0.1.x、macOS / Linux、以后的新版本。

换宿主版本时先看诊断，`/session-delete/state` 现在会直接列出拿到了哪些服务：

```json
{ "services": { "webServer": true, "registry": true, "sessions": true } }
```

哪个是 `false`，就说明新版改了那个名字 —— 改 `lib/index.js` 里对应的 `ctx.get('…')` 即可，不用猜。

缺东西时的表现，都不会崩：

| 缺什么 | 表现 |
|---|---|
| `workspaceRegistry` | 退回改 `workspace.json`（带备份） |
| `sessions` | 跳过 detach |
| `webServer`（headless / TUI） | 宿主半边不加载 |
| 座位名变了 | 按钮不出现，不报错 |

## 常见问题

**装了没反应？**
`/session-delete/ping` 打不开 = 没加载，查 `bundles` 和有没有重启；打得开但没按钮 = 座位名对不上，把 `/state` 发出来。

**提示 npm 不是内部或外部命令？**
没装 Node。下 ZIP 解压改名 `dsh-session-delete`，丢进 `node_modules\`，`bundles` 加一行。

**改坏了 package.json？**
同目录找 `package.json.bak-*` 改回去。

**删错了能恢复吗？**
不能。删前备份 `~/.dsh/sessions` 和 `storages\workspace.json`。

**能只删一部分消息吗？**
不能，只能整条。

**会不会误删正在用的这条？**
会弹窗确认。删完页面重载到新会话。

**删完真的释放磁盘了吗？**
是，正文和投影缓存都删了。

**内容会不会外传？**
不会。没有外发请求，只读写本机 `~/.dsh`。

**影响 DSH 更新吗？**
不影响，只是把入口换了位置。

**别把端口开到公网是什么意思？**
四条路由没密码，端口映射出去谁都能调删除。

**Mac / Linux 呢？**
逻辑跨平台，没实测。

## 卸载

删 `bundles` 里那行、删 `dependencies` 里那行、删 `node_modules\dsh-session-delete`，重启。

## 已知问题

- 座位名写死：`sidebar.workspaces.session.row.action`、`shell.overlay`。宿主改名后按钮消失，改 `lib/client.js` 顶部常量。
- 隐藏更新按钮靠 `_indicator` 类名后缀判断，宿主换类名会失效（不影响删除）。
- 并发删同一个 id 没去重。
- `workspace.json` 退路只删 id，不做结构迁移。

## 用户须知

**删了不进回收站。** 没有撤销，我也找不回来。

- `force` 会打断那条会话正在跑的回合。
- 用前备份 `~/.dsh/sessions` 和 `storages/workspace.json`。
- 四条路由无鉴权，别把 web 端口开到公网。
- 不联网、不收集数据，只读写本机 `~/.dsh`。
- 数据丢失、工作中断、业务损失作者不赔，也没有响应时限。完整条款见 [DISCLAIMER.md](DISCLAIMER.md)。

## 作者

**小富富** · QQ **811588817**

插件问题先看上面「常见问题」，再把 `/session-delete/state` 贴过来。

接活：网站、小程序搭建部署，服务器、域名、支付接口对接，一条龙。加 QQ 直接说需求。

## 许可

[MIT](LICENSE) © 小富富

<div align="center">
  <a href="https://star-history.com/#xffwlkjgzs88/dsh-session-delete&Date">
    <img src="https://api.star-history.com/svg?repos=xffwlkjgzs88/dsh-session-delete&type=Date" alt="Star History" width="640" />
  </a>
</div>
