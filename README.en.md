<div align="center">

<img src="assets/banner.svg" width="100%" alt="dsh-session-delete" />

<h1>dsh-session-delete</h1>

<p>
  <b>A real “delete” button for DSH session rows</b><br/>
  <sub>make the host registry forget → remove body &amp; projection cache → broadcast removal → watchdog re-check</sub>
</p>

<p>
  <a href="https://github.com/xffwlkjgzs88/dsh-session-delete/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/YG/dsh-session-delete?style=flat-square&label=Stars&color=2f81f7&logo=github&logoColor=white"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-3fb950?style=flat-square"></a>
  <a href="#"><img alt="Awesome" src="https://img.shields.io/badge/awesome-DSH%20plugin-ff6b6b?style=flat-square"></a>
  <a href="#compatibility"><img alt="DSH" src="https://img.shields.io/badge/dsh-0.2.x-8b5cf6?style=flat-square"></a>
  <a href="#compatibility"><img alt="Node" src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=nodedotjs&logoColor=white"></a>
</p>

<p>
  <b>English</b> · <a href="README.md">简体中文</a>
</p>

</div>

---

> **TL;DR** — Delete a session in DSH's sidebar, restart, and it comes back. This plugin actually deletes it.

<img src="assets/preview.svg" width="100%" alt="Delete confirmation dialog (mock)" />

## Why

DSH has no session delete — only archive. The intuitive workaround is deleting the session directory on disk. It looks like it worked, then the session reappears a minute later, or after a restart.

v0.1 did exactly that, and the on-disk backups tell the whole story:

```text
12:48:57  workspace.json: (empty)                    ← plugin deleted it
12:49:14  workspace.json: host flush, updatedAt changed
12:49:20  workspace.json: d2f98c9f, 3caf4ef1         ← deleted ids are back
```

**Root cause**: DSH's `WorkspaceRegistry` holds authoritative state **in memory**. Any other write — creating a session, archiving, pinning, renaming — flushes that in-memory state back over `workspace.json`, resurrecting the removed `sessionId`. Live sessions in `SessionStore` were never detached at all.

> **Touching only files, without the live host services, cannot delete a session.**

v0.2 is built around that conclusion: let the services forget first, touch the disk second, and add a watchdog for the flush-back.

## Features

| | Feature | Notes |
|:--:|---|---|
| 🗑 | Row-level delete button | Appears on hover after `···`, no permanent visual noise |
| ⛓ | Registry-level forget | `detachSession` + clears `archived` / `pinned` sets |
| 🧊 | Three places at once | `sessions/<bucket>/<id>/`, projection cache, sidebar record |
| ⚡ | Instant row removal | `emit('api-session/removed', id)` — no full reload needed |
| 🐕 | Watchdog | Re-checks at 1.2 s / 4 s and cleans again if the id resurfaces |
| 🧯 | Fallback | Without `workspaceRegistry`, rewrites JSON and keeps a timestamped `.bak` |
| 🪟 | Theme aware | Uses host `--dsw-alias-*` tokens, works in light and dark |
| 🧹 | Client state cleanup | Removes `dsh.conversation.<id>`, `dsh.sidebar-right.v1.<id>`, `dsh.sessions.current` |
| ⚙️ | Update row relocated | Hides the native sidebar update indicator, adds an equivalent row under Settings → General |
| 0️⃣ | Zero runtime deps | Two files, no third-party packages, all timers `unref`ed |

## Install

Requirements: Node.js ≥ 18, DSH ≥ 0.2. **Restart DSH after editing** — bundles load at startup.

Edit the profile you actually use (`~/.dsh/profiles/<profile>/package.json`, `web` for `dsh web`, `desktop` for the desktop build):

```jsonc
{
  "dependencies": {
    "dsh-session-delete": "github:YG/dsh-session-delete"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "…", "dsh-session-delete"]
    }
  }
}
```

Then `npm install` in that directory and restart DSH. Local tgz (`npm pack` → `file:C:/path/to.tgz`) and plain copy into `node_modules/` work the same way.

Verify:

```text
GET http://127.0.0.1:19387/session-delete/ping
{"ok":true,"home":"C:\\Users\\you\\.dsh","version":"0.2.0"}
```

## Usage

Hover a session row in the sidebar; a 🗑 appears after the `···`. First click turns it into “Confirm? …” (valid for 3.5 s). Second click deletes for real. Sessions that are running ask for explicit confirmation, then go through with `force: true` — the host acknowledges before acting, so deleting the session you are looking at still returns a response.

## HTTP API

```http
GET  /session-delete/ping                 → {ok, home, version}
GET  /session-delete/state                → host view vs. on-disk view
POST /session-delete/delete               → {sessionId} | {sessionId, force:true}
                                            200 done / 202 deferred / 409 running / 400 invalid
```

`steps` in the response is a per-step log; failures are reported as `fail: …` rather than hidden.

## How it works

1. Stop activity of a running session (`archiveSession({ stopActivity: true })`).
2. Detach from `SessionStore`, firing `session/disposed`.
3. `detachSession(id)` on every workspace entity, clear `archived` / `pinned`.
4. Delete `sessions/<bucket>/<id>/` and the projection cache JSON.
5. `emit('api-session/removed', id)` so the browser list drops the row immediately.
6. Watchdog at 1.2 s / 4 s re-checks and re-forgets if the host flushed the id back.

Services available ⇒ never double-write `workspace.json`. Services absent ⇒ rewrite it, keeping a backup.

## Compatibility

| | |
|---|---|
| DSH web (`dsh web`, profile `web`) | ✅ verified on 0.2.x |
| DSH desktop (EXE, profile `desktop`) | ✅ same routes and button |
| Node.js | ≥ 18 |
| OS | Windows / macOS / Linux |
| Third-party deps | none |

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No 🗑 on hover | Not in `bundles`, or not restarted | Check `bundles`, restart |
| `/session-delete/ping` 404 | Host half not loaded (no `webServer`) | Not a headless/TUI scenario |
| Comes back after restart | Old file-only deletion path | Use 0.2, then check `/state` |
| 409 `running` | Session is live — expected | Confirm the force dialog |
| Blank page after deleting current session | Reload in progress | ~0.9 s and you land in a fresh session |

## Notice

- Deletion is permanent — no trash bin, no soft delete.
- Force delete interrupts the running turn of that session.
- Do not expose the DSH web port publicly: these routes are same-origin and unauthenticated.

## License

[MIT](LICENSE) © YG

<div align="center">
  <a href="https://star-history.com/#xffwlkjgzs88/dsh-session-delete&Date">
    <img src="https://api.star-history.com/svg?repos=xffwlkjgzs88/dsh-session-delete&type=Date" alt="Star History Chart" width="640" />
  </a>
</div>
