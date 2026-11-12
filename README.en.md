<div align="center">

<img src="assets/banner.svg" width="100%" alt="dsh-session-delete" />

<h1>dsh-session-delete</h1>

<p>
  <b>A delete button that actually deletes DSH sessions</b><br/>
  <sub>not archive — remove</sub>
</p>

<p>
  <a href="https://github.com/xffwlkjgzs88/dsh-session-delete/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/xffwlkjgzs88/dsh-session-delete?style=flat-square&label=Stars&color=2f81f7&logo=github&logoColor=white"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-3fb950?style=flat-square"></a>
  <a href="DISCLAIMER.md"><img alt="Disclaimer" src="https://img.shields.io/badge/disclaimer-read-d29922?style=flat-square"></a>
  <a href="#compatibility"><img alt="DSH" src="https://img.shields.io/badge/dsh-0.2.x-8b5cf6?style=flat-square"></a>
  <a href="#compatibility"><img alt="Node" src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=nodedotjs&logoColor=white"></a>
  <a href="https://wpa.qq.com/msgrd?v=3&amp;uin=811588817&amp;site=qq&amp;menu=yes"><img alt="QQ" src="https://img.shields.io/badge/QQ-811588817-12B7F5?style=flat-square&logo=tencentqq&logoColor=white"></a>
</p>

<p>
  <b>English</b> · <a href="README.md">简体中文</a>
</p>

</div>

---

<img src="assets/preview.png" width="100%" alt="Delete dialog" />

## Why this exists

DSH only archives sessions; there is no delete. The obvious workaround is removing the session directory under `~/.dsh/sessions/`. It looks fine for a minute, then the session reappears — and after a restart it is back for good.

The reason took a night to find: `WorkspaceRegistry` keeps the whole sidebar state **in memory**. Deleting files doesn't tell it anything, and the next write flushes that in-memory state back over `workspace.json`, bringing the removed `sessionId` along. The backups showed it plainly:

```text
12:48:57  workspace.json: (empty)                    plugin deleted it
12:49:14  workspace.json: host flush, updatedAt      host writes back
12:49:20  workspace.json: d2f98c9f, 3caf4ef1         deleted ids are back
```

So the order here is inverted: make the host forget first, touch the disk second, then watch for a few seconds in case it writes back.

## What happens when you delete one

1. A running session is stopped first (`archiveSession({ stopActivity: true })`), then 300 ms for the last flush to land.
2. Detach from `SessionStore`, firing `session/disposed`.
3. `detachSession(id)` on every workspace entity, plus cleaning `archived` / `pinned`.
4. Remove `sessions/<bucket>/<id>/` and the projection cache JSON.
5. `emit('api-session/removed')` so the row drops immediately.
6. Re-check at 1.2 s and 4 s; if the id came back, clean it again.

Without the `workspaceRegistry` service (renamed, or headless), it falls back to rewriting `workspace.json` and keeps a `workspace.json.bak-<timestamp>`. When the service is there, it never double-writes — two writers over one JSON file is how you get unreproducible bugs.

## Install

### Let an AI do it

Paste this into any assistant (the DSH chat itself, Cursor, Claude, ChatGPT):

```text
Install the DSH plugin dsh-session-delete (GitHub: xffwlkjgzs88/dsh-session-delete):

1. Find my profile: ~/.dsh/profiles/web for the web build, ~/.dsh/profiles/desktop for the desktop build.
   If both exist, ask me instead of guessing.
2. Back up that package.json as package.json.bak-before-session-delete.
3. Add "dsh-session-delete": "github:xffwlkjgzs88/dsh-session-delete" to dependencies.
4. Append "dsh-session-delete" to dsh.profile.bundles.
5. Run npm install in that directory.
6. Tell me how to restart DSH (quit and relaunch — no OS reboot, no client update).
7. After restart, have me open http://127.0.0.1:19387/session-delete/ping and expect {"ok":true,...}.

Do not upgrade Node or DSH, and do not touch any other field.
```

Only DSH itself needs a restart — no client update, no reinstall.

### Manual

Node.js 18+, DSH 0.2+. Restart required — bundles load at startup.

Edit the profile you actually use (`~/.dsh/profiles/web/package.json` or `…/desktop/package.json`):

```jsonc
{
  "dependencies": {
    "dsh-session-delete": "github:xffwlkjgzs88/dsh-session-delete"
  },
  "dsh": {
    "profile": {
      "bundles": ["…existing…", "dsh-session-delete"]
    }
  }
}
```

Run `npm install` in that directory, then restart DSH.

```text
GET http://127.0.0.1:19387/session-delete/ping
{"ok":true,"home":"C:\\Users\\you\\.dsh","version":"0.3.0"}
```

A prebuilt `.tgz` is attached to the release page; `npm pack` works too, as does dropping the directory into `node_modules/`.

## Usage

Hover a session row and a bin icon shows up after the `···`. The first click turns it into a red “Confirm?” valid for 3.5 s; the second click deletes. Running sessions ask separately, because `force` interrupts the turn in progress. When you delete the session you're looking at, the server replies *before* acting — otherwise the response never gets out.

## API

```http
GET  /session-delete/ping     → {"ok":true,"home":"…","version":"0.3.0"}
GET  /session-delete/state    → registry view vs. on-disk view
GET  /session-delete/size?sessionId=…  → bytes this session occupies
POST /session-delete/delete   → {"sessionId":"…"} or {"sessionId":"…","force":true}
```

| Result | Response |
|---|---|
| Deleted | `200` + `steps` |
| Running, no force | `409 {"code":"running","current":true}` |
| Running, force | `202`, executed 60 ms later |
| Bad id / bad method | `400` / `405` |

`steps` records each step; failures read `fail: …` instead of pretending otherwise. `/state` is the debugging entry point — it lines up `sessionIds` from the registry against what is actually on disk. See [docs/api.md](docs/api.md) and [docs/internals.md](docs/internals.md).

## Compatibility

Only verified on **DSH 0.2.x / Windows**. I can't call it universal, but I can say this: **it won't break your DSH**.

The plugin touches four public surfaces — `workspaceRegistry`, `sessions`, `webServer.register`, `slots.inject`. If one is missing it degrades or simply stays invisible:

| Missing | Behaviour |
|---|---|
| `workspaceRegistry` | falls back to rewriting `workspace.json` (with a backup) |
| `sessions` | skips the detach step |
| `webServer` (headless / TUI) | host half never loads, silently |
| slot name changed | button never appears, no error |

Check your build with `/session-delete/ping` (alive?) and `/session-delete/state` (`registry: service` = primary path, `file-only` = degraded, `absent` = service not found). Test on a session you don't need first.

## Known issues

- Slot names are hard-coded (`sidebar.workspaces.session.row.action`, `shell.overlay`). If DSH renames them, the button disappears silently — fix the two constants at the top of `lib/client.js`.
- No de-duplication for concurrent deletes of the same id.
- The `workspace.json` fallback only removes ids; it does not migrate structure.

## Read before use

**Deletion is permanent.** No trash, no undo, and no way for the author to recover it. Back up `~/.dsh/sessions` and `storages/workspace.json` first. The HTTP routes are unauthenticated — never expose the DSH web port publicly. The author accepts no liability for data loss or interrupted work; the full terms are in [DISCLAIMER.md](DISCLAIMER.md).

## Author

**小富富 (Xiao Fufu)** · QQ **811588817**

Bug reports: include the `/session-delete/state` output. Also available for website / mini-program build and deployment, servers, domains, and payment API integration.

## License

[MIT](LICENSE) © 小富富
