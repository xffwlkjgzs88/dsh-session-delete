# 参与贡献

这个插件很小，两个文件，没有构建步骤，也没有第三方依赖。改起来不难，但有几条先说在前面。

## 提 Issue 之前

先做这两件事，九成的问题当场能定位：

1. 打开 `http://127.0.0.1:19387/session-delete/state`，看 `registry`、`onDisk`、`cacheIds` 三处对不对得上；
2. 手动删一次，把返回里的 `steps` 贴出来 —— 哪一步写成 `fail:`，问题就在那一步。

贴的时候记得把 `home` 路径里的用户名打码。

## 提 PR 的规矩

- **别加依赖。** 这个插件不引第三方包是有意的，宿主里跑的东西越干净越好。
- **别改删除顺序。** 「先停活 → 再 detach → 再删文件 → 最后广播」这个顺序是有原因的，见 [docs/internals.md](docs/internals.md)。要改先开 issue 说清楚为什么。
- **别把服务可用时的路径改成双写。** `workspaceRegistry` 在的时候只走服务，不额外写 `workspace.json`。
- 两个文件都保持零构建：`lib/index.js` 是 ESM，`lib/client.js` 是宿主 `__ModuleLoader__` 的包裹格式，不要改成 `import` 写法。

## 提交前跑一遍

```bash
npm run lint    # node --check 两个文件
npm test        # 冒烟测试：导出了什么、注册了哪几条路由
```

CI 也会跑这两个，红了不会合。

## 文案

中文为主。README 里的技术描述尽量写「实际发生了什么」，少写形容词。
