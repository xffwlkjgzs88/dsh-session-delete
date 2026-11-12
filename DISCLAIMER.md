# 免责声明 / Disclaimer

本文件是 dsh-session-delete（下称"本软件"）的使用条款。**安装或使用本软件，即表示你已阅读并同意以下全部内容。**

---

## 中文

### 1. 按现状提供

本软件按「现状」（AS IS）提供，不附带任何形式的明示或暗示担保，包括但不限于对适销性、特定用途适用性、无侵权、无错误、不中断的担保。作者不承诺本软件在任何 DSH 版本、任何操作系统上都可用。

### 2. 核心功能是不可逆的数据删除

本软件的主要功能是**永久删除**会话数据：会话正文目录、投影缓存、宿主 registry 中的记录。**删除后不可恢复，没有回收站，没有软删除，作者也无法帮你找回。**

使用前请自行备份，至少包括：

```text
~/.dsh/sessions/
~/.dsh/storages/workspace.json
~/.dsh/storages/session_projcache/
```

### 3. 责任免除

因使用或无法使用本软件而产生的任何直接或间接损失——包括但不限于**数据丢失、会话内容无法找回、工作中断、运行中的对话回合被打断、业务或利润损失、第三方索赔**——由使用者自行承担。作者不承担任何赔偿责任，也不承担任何形式的连带责任。

### 4. 已知的高风险操作

- `force: true` 的强制删除会**立即中断**该会话正在执行的回合；
- 删除当前正在使用的会话，会导致当前这一轮对话中断，页面重载后落到新会话；
- 本插件的四条 HTTP 路由**没有鉴权**，只应在本机 loopback 上使用。把 DSH 的 web 端口暴露到公网，等于把删除能力开放给任何能访问该端口的人，由此产生的后果由使用者承担。

### 5. 非官方

本软件是第三方插件，与 DeepSeek、DeepSeek Harness（DSH）官方无任何隶属或背书关系。插件通过宿主公开的服务与事件工作，宿主升级后可能失效，作者不承诺跟进。

### 6. 合规使用

使用者应自行确保使用场景合法合规，包括但不限于所在地区关于数据留存、个人信息、审计记录的规定。因使用本软件违反任何法律法规或内部规章的，责任由使用者承担。

### 7. 条款变更

本声明可能随版本更新而修改，修改后在仓库中发布即生效。不同意新条款的，请停止使用并卸载本软件。

---

## English

Provided **AS IS**, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement.

The software **permanently deletes** session data (conversation body, projection cache, host registry entries). **Deletion is irreversible.** Back up `~/.dsh/sessions`, `~/.dsh/storages/workspace.json` and `~/.dsh/storages/session_projcache` before use.

In no event shall the author be liable for any claim, damages or other liability — including data loss, interrupted turns, business interruption or lost profits — arising from, out of or in connection with the software or its use.

The HTTP routes are **unauthenticated**. Do not expose the DSH web port to the public internet.

This is an unofficial third-party plugin, not affiliated with or endorsed by DeepSeek or DeepSeek Harness.

---

## 联系方式 / Contact

作者：小富富 · QQ：**811588817**

（联系方式仅用于插件本身的技术问题，不构成任何服务承诺或担保。）
