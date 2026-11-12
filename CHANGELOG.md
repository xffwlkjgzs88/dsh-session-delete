# Changelog

本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.3.0]

### Added

- `GET /session-delete/size?sessionId=…`：删除前先算这条会话占多少（正文目录 + 投影缓存），弹窗里显示「占用 48.2 MB」。拿不到就整行不显示，不影响删除。
- README 顶部新增「让 AI 帮你装」：一段可以直接粘给 AI 的安装指令，包含备份、判断 profile、改两处配置、跑 `npm install`、重启与验证，以及"不要升级 Node / DSH"的限制。
- 兼容性章节重写：说明只实测过 DSH 0.2.x，以及缺 `workspaceRegistry` / `sessions` / `webServer` / 座位名时的四种降级表现和自检办法。

### Changed

- 删除弹窗重做：蒙层加磨砂、卡片入场动画、危险按钮改实心红、加一条 meta 行显示会话短 id 与占用体积；默认焦点落在「取消」，误按回车是取消而不是删除。跟随 `prefers-reduced-motion`。
- 行内按钮：静止半透明，悬停变红并轻微上移，按下回弹，键盘 focus 有描边。
- README 删掉关于 `cordis.patch.yml` 的那句补充说明。

### Docs

- 新增 [DISCLAIMER.md](DISCLAIMER.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 作者信息写入 `package.json`，README 增加「关于作者」与「用户须知」。
- 中英文 README 按「起因 → 发生了什么 → 安装 → 用法」重写。

## [0.2.0] — 首个公开版本

### Added

- 会话行悬停出现 🗑，两次点击确认（3.5s 内有效）后真删。
- `POST /session-delete/delete`：`workspaceRegistry.detachSession` + 清空 `archived` / `pinned` 集合。
- 运行中会话返回 `409 running`，带 `force: true` 时先回 `202` 再后台执行。
- 删除会话正文目录、投影缓存 JSON，并 `emit('api-session/removed')` 让列表立刻掉行。
- 看门狗：删除后 1.2s / 4s 复核，发现宿主把 id 写回则再次清理。
- 浏览器侧清 `dsh.conversation.<id>`、`dsh.sidebar-right.v1.<id>`、`dsh.sessions.current`。
- `GET /session-delete/state`：把宿主 registry 视图与磁盘实际内容并排输出，便于排错。
- 服务缺席时退回直接改 `workspace.json`，并保留 `workspace.json.bak-<时间戳>`。
- 隐藏侧栏左下角原生「新版本」按钮，在「设置 → 通用」补一条等价的「版本更新」行（走原生 `dshDesktop.updates` 桥）。

### Fixed

- **v0.1 删不掉的根因**：只改磁盘不碰宿主活服务，宿主内存状态会整体刷回 `workspace.json`，被删的 `sessionId` 复活。v0.2 改为先让服务遗忘，再动文件。

## [0.1.0]

- 内部试验版本：仅删除磁盘上的会话目录、投影缓存并改写 `workspace.json`。已知会复活，未公开。
