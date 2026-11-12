# 免责声明 / Disclaimer

**dsh-session-delete**（下称"本软件"）由个人开发者提供。**安装、运行或以任何方式使用本软件，即视为你已完整阅读并接受本文件全部条款。** 不接受的话，请立即停止使用并删除本软件。

本文件与 [LICENSE](LICENSE)（MIT）并存：MIT 授予你代码层面的使用权，本文件说明使用后果由谁承担。

---

## 1. 按现状提供，不作任何担保

本软件按「现状」（AS IS）与「现有」（AS AVAILABLE）提供，不附带任何明示或默示担保，包括但不限于：适销性、特定用途适用性、权利无瑕疵、不侵权、无错误、不中断、与任何特定 DSH 版本兼容。

作者不承诺本软件会持续维护、修复缺陷、适配新版宿主，也不承诺任何响应时间。

## 2. 核心功能是不可逆的数据删除

本软件的主要功能是**永久删除**会话数据：

- 会话正文目录 `~/.dsh/sessions/<bucket>/<sessionId>/`
- 投影缓存 `~/.dsh/storages/session_projcache/sessions/<sessionId>.json`
- 宿主侧栏记录（`workspace.json` 中对应条目、archived / pinned 集合中的 id）

**删除后不可恢复。没有回收站、没有软删除、没有版本历史，作者也无法帮你找回。**

使用前请自行备份，至少包括：

```text
~/.dsh/sessions/
~/.dsh/storages/workspace.json
~/.dsh/storages/session_projcache/
```

## 3. 界面改动告知

本软件会修改你看到的部分界面，**这两点在使用前必须知道**：

1. **在会话行增加一个删除按钮**（主功能）。
2. **隐藏侧栏左下角的"新版本"指示器**，并在「设置 → 通用 → 当前版本」下方增加一行等价的"版本更新"入口。该改动仅在桌面版且宿主提供 `dshDesktop.updates` 时生效；web 版不做任何隐藏。

不想保留第 2 项改动，可在开发者工具 Console 执行：

```js
localStorage.setItem('dsh.session-delete.hideUpdateBadge', '0')
```

刷新后原生按钮恢复。作者不保证该开关在宿主未来版本中仍然有效。

## 4. 数据处理与隐私

- 本软件**不收集、不上传、不统计**任何数据，代码中不存在任何向外部服务器发起的网络请求。
- 它只在**本机**读写 `~/.dsh` 下的文件，以及在本机 `127.0.0.1` 的 DSH web 服务上注册 HTTP 路由。
- 宿主日志中可能记录被删除的 `sessionId`（例如看门狗复核失败时的警告），这属于宿主自身行为。
- 你在本软件运行期间产生的任何数据，其保存、备份与销毁责任由你承担。

## 5. 无支持义务

作者提供本软件不构成任何服务承诺：

- 不承诺响应问题的时间，不承诺修复任何具体缺陷；
- 不承诺为你的具体环境（版本、系统、第三方插件组合）做适配；
- 通过 QQ 等渠道的沟通属自愿协助，不产生合同义务；
- 作者另有承接的商业业务与本软件**无关**，不因你提出需求而自动成立委托关系。

## 6. 责任限制

在适用法律允许的最大范围内：

- 本软件免费提供，作者就本软件不收取任何费用；
- 对于因使用或无法使用本软件而产生的任何直接、间接、附带、特殊、惩罚性或后果性损失——包括但不限于**数据丢失、会话内容无法找回、工作中断、正在执行的对话回合被中断、设备或系统异常、业务中断、利润损失、第三方索赔**——作者**不承担任何赔偿责任**；
- 即使作者已被告知上述损失的可能性，本条仍然适用；
- 若某些司法辖区不允许排除或限制特定责任，则本条在该辖区按法律允许的最小范围适用，其余条款继续有效。

## 7. 使用者义务

你应自行确保：

- **已备份**你认为重要的数据；
- 使用场景**合法合规**，包括所在地关于数据留存、个人信息、审计留痕、行业监管的规定；
- 不将本软件用于**删除他人数据**、规避审计、掩盖违规行为等用途；
- **不把 DSH 的 web 端口暴露到公网**。本软件注册的四条 HTTP 路由（`/session-delete/ping|state|size|delete`）**没有鉴权**，任何能访问该端口的人都能触发删除；
- 不修改、不重打包后再以作者名义分发，或分发时移除本声明。

## 8. 非官方与商标

本软件是第三方插件，与 DeepSeek、DeepSeek Harness（DSH）及其关联方**无任何隶属、授权或背书关系**。相关名称与商标归其权利人所有。宿主升级可能导致本软件失效，作者不承担由此产生的任何责任。

## 9. 条款变更与可分割性

- 本声明可能随版本更新而修改，修改后在本仓库发布即生效，不另行通知。
- 若任一条款被认定无效或不可执行，该条款在最小必要范围内调整，其余条款继续有效。

## 10. English summary

Provided **AS IS**, without warranty of any kind. The software **permanently deletes** DSH session data; deletion is irreversible — back up `~/.dsh/sessions` and `~/.dsh/storages/workspace.json` first.

It also **hides the native update indicator** in the desktop build and adds an equivalent row under Settings → General. Opt out with `localStorage.setItem('dsh.session-delete.hideUpdateBadge', '0')`.

It collects no data and makes no outbound network requests. Its HTTP routes are **unauthenticated** — never expose the DSH web port publicly.

The author accepts **no liability** for data loss, interrupted work, business loss or third-party claims. This is an unofficial third-party plugin, not affiliated with DeepSeek or DeepSeek Harness.

---

## 联系方式 / Contact

作者：小富富 · QQ：**811588817**

（联系方式仅用于本软件的技术问题，不构成服务承诺、担保或商业委托。）
