<#
.SYNOPSIS
    一键把 dsh-session-delete 发布到 GitHub（建仓 + 改写占位符 + 首次推送）。

.DESCRIPTION
    需要 GitHub Personal Access Token：
      classic  → 勾 repo
      fine-grained → Repository permissions: Administration(Read/Write) + Contents(Read/Write)

    Token 从参数 -Token 或环境变量 GITHUB_TOKEN 读取，不会写进任何文件。

.EXAMPLE
    $env:GITHUB_TOKEN = "ghp_xxx"
    pwsh ./publish.ps1

.EXAMPLE
    pwsh ./publish.ps1 -Owner YG -Repo dsh-session-delete -Private
#>
[CmdletBinding()]
param(
    [string]$Token = $env:GITHUB_TOKEN,
    [string]$Owner,
    [string]$Repo = 'dsh-session-delete',
    [string]$Description = '真删除 DSH 会话：让宿主 registry 遗忘 + 清正文与投影缓存 + 广播移除事件',
    [switch]$Private,
    [switch]$SkipCreate,
    [switch]$NoRewrite,
    [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Ok($text)   { Write-Host "    $text" -ForegroundColor DarkGray }

if (-not $Token) {
    throw "缺少 Token：设置 `$env:GITHUB_TOKEN` 或用 -Token 传进来。"
}

$headers = @{
    Authorization          = "Bearer $Token"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
    'User-Agent'           = 'dsh-session-delete-publish'
}

# ---------------------------------------------------------------- 0. 身份
Step '校验 Token'
if (-not $Owner) {
    $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers
    $Owner = $me.login
}
Ok "账号：$Owner"

$full = "$Owner/$Repo"
$webUrl = "https://github.com/$full"

# ---------------------------------------------------------------- 1. 建仓
if (-not $SkipCreate) {
    Step "创建仓库 $full"
    $body = @{
        name           = $Repo
        description    = $Description
        private        = [bool]$Private
        has_issues     = $true
        has_projects   = $false
        has_wiki       = $false
        auto_init      = $false
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -Body $body | Out-Null
        Ok '已创建'
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 422) { Ok '仓库已存在，继续推送' }
        else { throw }
    }
}

# ---------------------------------------------------------------- 2. 改写占位符
if (-not $NoRewrite -and $Owner -ne 'YG') {
    Step "把文档里的 YG 替换成 $Owner"
    $targets = @('README.md', 'README.en.md', 'package.json', 'LICENSE', '.github/ISSUE_TEMPLATE/config.yml')
    foreach ($file in $targets) {
        if (-not (Test-Path $file)) { continue }
        $text = Get-Content $file -Raw -Encoding utf8
        $next = $text -replace 'github\.com/YG/', "github.com/$Owner/"
        $next = $next -replace 'repos=YG/', "repos=$Owner/"
        $next = $next -replace '#YG/', "#$Owner/"
        $next = $next -replace 'git\+https://github\.com/YG/', "git+https://github.com/$Owner/"
        $next = $next -replace 'Copyright \(c\) 2026 YG', "Copyright (c) 2026 $Owner"
        if ($next -ne $text) {
            [System.IO.File]::WriteAllText((Join-Path $Root $file), $next, (New-Object System.Text.UTF8Encoding($false)))
            Ok "改：$file"
        }
    }
}

# ---------------------------------------------------------------- 3. 提交
Step 'git 初始化与提交'
if (-not (Test-Path '.git')) { git init -q; Ok 'git init' }
git branch -M main 2>$null

if (-not (git config user.name)) { git config user.name $Owner }
if (-not (git config user.email)) { git config user.email "$Owner@users.noreply.github.com" }
Ok ("作者：" + (git config user.name) + " <" + (git config user.email) + ">")

git add -A
$pending = git status --porcelain
if ($pending) {
    git commit -q -m "feat: dsh-session-delete 0.2.0 — 真删除 DSH 会话"
    Ok '已提交'
} else {
    Ok '没有新改动'
}

# ---------------------------------------------------------------- 4. 推送
if ($SkipPush) { Step '按 -SkipPush 跳过推送'; return }

Step "推送到 $webUrl"
$clean = "https://github.com/$full.git"
git remote remove origin 2>$null
git remote add origin $clean

$pair = "x-access-token:$Token"
$b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
git -c "http.extraheader=AUTHORIZATION: basic $b64" push -u origin main
if ($LASTEXITCODE -ne 0) { throw "push 失败（退出码 $LASTEXITCODE）" }

Ok '推送完成'
Write-Host ''
Write-Host "仓库： $webUrl" -ForegroundColor Green
if (-not $Private) {
    Write-Host "建议：Topics 里加 dsh dsh-plugin session-delete cordis；Release 传 npm pack 出来的 tgz。" -ForegroundColor DarkGray
}
