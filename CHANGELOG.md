# Changelog

本项目遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [未发布]

### Docs

- 新增 [DISCLAIMER.md](DISCLAIMER.md)：完整免责声明（中英），覆盖不可恢复的数据删除、强制删除中断、无鉴权路由、非官方插件。
- 新增 [CONTRIBUTING.md](CONTRIBUTING.md)：提 issue 前的自查项与 PR 规则。
- README 增加「用户须知」「已知问题」「关于作者」，作者信息与联系方式写入 `package.json`。
- 重写中英文 README 的行文，删掉特性清单式表格，改成按「起因 → 发生了什么 → 怎么用」讲。

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
