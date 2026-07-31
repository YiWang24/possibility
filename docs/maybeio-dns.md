# maybeio.com 域名配置

> 核查时间：2026-07-31。链路：Namecheap（注册商）→ Cloudflare（DNS）→ Vercel（托管）。

## 现状

| 项 | 状态 |
| --- | --- |
| 注册商 | Namecheap |
| 权威 DNS | Cloudflare（`hayes` / `kenia.ns.cloudflare.com`），记录为 DNS-only 未开代理 |
| 托管 | Vercel 项目 `possibility-web`，`main` 分支自动部署 |
| apex | `216.198.79.1` / `64.29.17.1`（Vercel Anycast），308 跳转到 www |
| www | CNAME → `vercel-dns-017.com` |
| 证书 | Let's Encrypt，Vercel 自动签发与续期 |
| 收信 | MX → Namecheap 免费转发（`eforward1-5.registrar-servers.com`） |
| 发信 | **无**。域名下没有任何 DKIM 记录；产品验证邮件走 Supabase 自定义 SMTP，发件域是 `yilab.tech` 而非本域 |

## 待添加的 DNS 记录

以下记录需要在 **Cloudflare → maybeio.com → DNS** 手动添加（当前仓库里的 Cloudflare token 只有 R2 权限，无 zone 权限，无法用脚本下发）。

### 1. DMARC —— 阻断域名被冒充发信（最高优先级）

| Type | Name | Content |
| --- | --- | --- |
| TXT | `_dmarc` | `v=DMARC1; p=reject; adkim=s; aspf=s; fo=1; rua=mailto:dmarc@maybeio.com` |

**为什么可以直接上 `p=reject`**：本域名当前零发信（已核实无任何 DKIM 选择器记录、Supabase SMTP 从 `yilab.tech` 发件、Resend 未接入本域）。没有合法发信方，就不存在误杀风险，而 `p=none` 只做观测、不提供任何实际防护。

`rua` 地址需要在 Namecheap 的邮件转发里加一条 `dmarc@` 的转发规则，否则聚合报告收不到。不想收报告可以整段删掉 `rua=`，DMARC 的拦截效果不受影响。

### 2. CAA —— 限制谁能为本域签发证书

| Type | Name | Content |
| --- | --- | --- |
| CAA | `@` | `0 issue "letsencrypt.org"` |
| CAA | `@` | `0 issuewild ";"` |

`letsencrypt.org` 是实测的当前签发方（`www` 与 apex 证书 issuer 均为 Let's Encrypt / CN=YR1）。`issuewild ";"` 禁止签发通配符证书——目前没有通配符需求，禁掉可以缩小攻击面。

> ⚠️ **改动前必读**：如果以后在 Cloudflare 把这条记录打开橙色云（代理模式），Cloudflare Universal SSL 会改用 Google Trust Services / SSL.com 签发。**必须先补上 `0 issue "pki.goog"` 和 `0 issue "ssl.com"`，再开代理**，否则证书签发会被 CAA 挡住。

### 3. SPF 收紧（可选）

现有记录：`v=spf1 include:spf.efwd.registrar-servers.com ~all`

可以把结尾的 `~all`（softfail）改成 `-all`（hardfail）：

```
v=spf1 include:spf.efwd.registrar-servers.com -all
```

DMARC 上了 `p=reject` 之后这一步收益有限，属于锦上添花。

## 以后要从 @maybeio.com 发信时

上面的 `p=reject` 会拦掉所有未通过认证的发信。接入新发信方（Resend / Zoho / Gmail「以此地址发送」等）时，**顺序不能反**：

1. 先在服务商处添加域名，拿到它给的 DKIM 记录（形如 `resend._domainkey`）并加到 Cloudflare；
2. 把服务商的 SPF include 并进现有 SPF 记录（**一个域名只能有一条 SPF 记录**，必须合并而不是新增）；
3. 在服务商侧验证通过后，再实际发信。

跳过 1、2 直接发，邮件会被收件方按 DMARC 策略直接拒收。

## 应用侧已配置项

- Supabase 线上 Auth：`site_url` = `https://www.maybeio.com`；`uri_allow_list` 覆盖 apex / www / Vercel 预览域 / localhost（此前二者都还是 `http://localhost:3000`，导致生产环境的验证邮件链接与 OAuth 回调失效）。
- 站点常量集中在 `web/lib/site.ts`，预览环境可用 `NEXT_PUBLIC_SITE_URL` 覆盖。

## 未做（需要你决定）

- **HSTS preload**：`web/next.config.ts` 里已带 `includeSubDomains`，但没加 `preload`。提交到 hstspreload.org 后撤销要等数月，属不可逆操作，建议等子域规划定下来再手动加。
- **发件域品牌一致性**：产品在 `maybeio.com`，验证邮件却来自 `yiwang@yilab.tech`。要统一的话需按上一节流程把 `maybeio.com` 接入 Zoho 或 Resend。
- **Google Search Console 验证**：`web/app/layout.tsx` 已预留 `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`，设上环境变量即可自动注入 meta 标签。
