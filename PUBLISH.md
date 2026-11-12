# 发布到 GitHub

仓库已经是一个可以直接推送的 git 仓库（`git log` 里已有首个提交）。剩下三步。

## 一、拿一个 Token

GitHub → Settings → Developer settings → **Personal access tokens**

| 类型 | 需要的权限 |
|---|---|
| Classic | `repo`（私有仓还要 `delete_repo` 之类按需勾） |
| Fine-grained | 目标账号下：**Administration: Read and write** + **Contents: Read and write** |

## 二、跑脚本

```powershell
cd dsh-session-delete
$env:GITHUB_TOKEN = "ghp_你的token"
pwsh ./publish.ps1
```

脚本会：

1. `GET /user` 确认账号（`-Owner` 不传就自动用 token 对应的 login）；
2. `POST /user/repos` 建公开仓（`-Private` 建私有仓；已存在则跳过）；
3. 把文档里所有 `YG` 占位符替换成你的用户名（`-NoRewrite` 关掉）；
4. `git init` / 提交 / 设 remote / 首次推送。

常用开关：

```powershell
pwsh ./publish.ps1 -Owner YG -Repo dsh-session-delete -Private
pwsh ./publish.ps1 -SkipCreate -SkipPush        # 只做本地整理
```

> 用 PowerShell 7（`pwsh`）跑。Windows PowerShell 5.1 读中文注释会乱码。

## 三、手工路线（不跑脚本）

```bash
git init -b main
git add -A
git commit -m "feat: dsh-session-delete 0.2.0 — 真删除 DSH 会话"
git remote add origin https://github.com/<你>/dsh-session-delete.git
git push -u origin main
```

装了 `gh` 的话更省事：

```bash
gh repo create dsh-session-delete --public --source=. --remote=origin --push \
  --description "真删除 DSH 会话：让宿主 registry 遗忘 + 清正文与投影缓存 + 广播移除事件"
```

## 四、建完仓之后顺手做的四件事

1. **Topics**：`dsh` `dsh-plugin` `deepseek-harness` `cordis` `session`；
2. **Release**：`npm pack` 出来的 `dsh-session-delete-0.2.0.tgz` 传到 tag `v0.2.0` 的附件里；
3. **About**：勾上 Issues、填一行简介、把 `assets/preview.svg` 作为 social preview 上传；
4. **README 里 4 处 `YG`**：脚本会改，手工路线记得自己搜一遍（badges、接口地址、Star History、LICENSE）。

## 五、发布后自检

```bash
curl -sI https://img.shields.io/github/stars/<你>/dsh-session-delete | head -1   # badges 200
npm run lint && npm run pack:check                                              # 本地没问题
```

在干净环境里按 README 的「方式 A」装一遍，确认：

```text
GET /session-delete/ping → {"ok":true,...}
```
