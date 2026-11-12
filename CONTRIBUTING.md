# 参与贡献

插件很小：两个文件、无构建、无第三方依赖。

## 提 Issue 前

1. 打开 `http://127.0.0.1:19387/session-delete/state`，看 `registry`、`onDisk`、`cacheIds` 三处对不对得上；
2. 删一条测试会话，把返回里的 `steps` 贴出来，哪一步是 `fail:`，问题就在哪。

贴的时候把 `home` 里的用户名打码。

## PR 规矩

- **别加依赖。** 宿主里跑的东西越干净越好。
- **别改删除顺序**：停活 → detach → 删文件 → 广播。要改先开 issue 说明原因，见 [docs/internals.md](docs/internals.md)。
- **服务可用时只走 registry**，不要额外写 `workspace.json`。
- **保持零构建**：`lib/index.js` 是 ESM，`lib/client.js` 是宿主的 `__ModuleLoader__` 包裹格式，别改成 `import`。

## 提交前

```bash
npm run lint    # node --check 两个文件
npm test        # 冒烟测试：导出、路由
```

CI 也会跑，红了不放行。
