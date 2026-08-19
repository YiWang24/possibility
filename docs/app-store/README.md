# App Store 上架资料

这份目录是 App Store Connect 的本地化上架真相源。当前主本地化为 `zh-Hans`，对应应用 `com.possibility.possibility`、版本 `1.0`。

## 文件

- [`metadata.zh-Hans.json`](./metadata.zh-Hans.json)：名称、分类、年龄分级、描述、关键词、审核说明和公开 URL。
- [`../../scripts/validate-app-store-metadata.mjs`](../../scripts/validate-app-store-metadata.mjs)：本地长度、URL 和必填字段校验。
- [`../../scripts/sync-app-store-metadata.mjs`](../../scripts/sync-app-store-metadata.mjs)：通过 App Store Connect API 做预检或显式同步。
- [`../design/appstore/`](../design/appstore/)：已按 1320 × 2868 输出的 iPhone 上架截图。

## 校验与同步

```bash
node scripts/validate-app-store-metadata.mjs
doppler run --project possibility --config prd -- node scripts/sync-app-store-metadata.mjs
```

第二条命令默认只读并打印差异。只有确认公开支持邮箱已经可收信、审核联系人电话已补入 JSON 后，才使用 `--write` 保存到 App Store Connect：

```bash
doppler run --project possibility --config prd -- node scripts/sync-app-store-metadata.mjs --write
```

同步工具不会打印 API key、P8 私钥或 JWT。它只更新当前 `zh-Hans` 本地化、1.0 版本、分类、年龄分级和审核信息，不会上传构建或提交审核。

首发版本不填写 `whatsNew`；后续新版本才在对应本地化中加入该字段。App Store Connect 不允许为首发版本保存这一项。

## 上线前检查

1. 将本分支合并到生产部署分支，使 `/privacy`、`/terms` 和 `/support` 在 `https://maybeio.com` 可访问。
2. 确认 `support@maybeio.com` 的收信配置；若不可用，先替换 metadata 和支持页中的邮箱。
3. 在 App Store Connect 的 App Review Information 中补入真实电话号码。
4. 选择已处理完成的 `Possibility 1.0.0 (107)` 或更新后的构建，再提交审核。
