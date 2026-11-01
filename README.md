# wows-page

一个静态的《战舰世界》个人战绩页面 —— 展示自己的账号数据，风格对齐 [Firefly](https://github.com/Cydiar/Firefly) 博客主题。

- 纯静态：构建期就把数据抓成 JSON，运行时零请求、零 key
- 无框架运行时：Astro + 手写 CSS，产物只有几十 KB
- 深浅色、响应式、可筛选的逐船战绩表
- 不改动博客本体，可独立部署，也可以挂在 `/wows/` 子路径

## 页面

| 路由 | 内容 |
| --- | --- |
| `/` | 账号总览：核心指标、舰种/等级分布、主力舰船、个人纪录、最近出港 |
| `/ships` | 逐船战绩表：搜索、按舰种/等级筛选、点表头排序 |

## 快速开始

```bash
pnpm install

# 1. 改 wows.config.json，填服务器和昵称
#    { "realm": "cn", "nickname": "你的游戏ID", "appId": "" }

# 2. 抓数据（需要 application_id）
WOWS_APP_ID=你的id pnpm fetch

# 3. 本地预览
pnpm dev        # http://localhost:4321
pnpm build      # 产物在 dist/
```

### 关于 application_id

**必须自己申请，官方没有公共 key**（`demo` 那个早就被封了）。

| 服务器 | 申请地址 | API 主机 |
| --- | --- | --- |
| 国服（360） | https://developers.wggames.cn/ | `api.wowsgame.cn` |
| 亚服 / 欧服 / 美服 / 俄服 | https://developers.wargaming.net/applications/ | `api.worldofwarships.<region>` |

登录后创建应用，立刻就能拿到 id，免费。国服和国际服的 id **不通用**，换服要重新申请。

拿到后建议放环境变量，不要写进仓库：

```bash
WOWS_APP_ID=xxxx WOWS_NICKNAME=凉柚NH3 WOWS_REALM=cn pnpm fetch
```

优先级：环境变量 > `wows.config.json`。

### 仓库里那份示例数据

`src/data/*.json` 是构建产物，可以直接提交（这样 CI 不依赖 key 也能构建）。
仓库里自带的一份是示例号 `Shaddock_NH3`（亚服）的数据，跑一次 `pnpm fetch` 就会覆盖成你自己的。

## 部署

### GitHub Pages

推上去，在仓库 Settings → Pages 里把 Source 选成 GitHub Actions 即可，
`.github/workflows/deploy.yml` 会在每次 push 后自动构建发布。

项目站点的地址是 `https://<user>.github.io/wows-page/`，工作流里已经自动把
`BASE_PATH` 设成 `/wows-page`，不用手动改。

### Vercel / Cloudflare Pages

框架预设选 Astro，构建命令 `pnpm build`，输出目录 `dist`。部署在根路径就不用管 base。

### 定时更新数据

`.github/workflows/update-data.yml` 每周一凌晨跑一次抓取并提交 `src/data`。
启用它需要在仓库 Secrets 里加：

- `WOWS_APP_ID`
- `WOWS_NICKNAME`
- `WOWS_REALM`（可选，默认 `cn`）

不启用也没关系，数据会一直停在最后一次手动抓取的状态。

## 挂到 Firefly 博客上

不想动博客源码的话，有两种方式：

1. **子路径**：把本站部署到 `blog.attilio.cc/wows/`（Vercel 上给同一个项目加 rewrite，
   或者单独部署后用 `rewrites` 转发），然后导航栏 `blogUrl` 反着指回去就行。
2. **独立域名**：本站单独部署，导航栏的「博客」按钮指回博客（改 `src/config.ts` 的 `blogUrl`）。

两种都不需要改博客的代码。

## 自定义

| 想改什么 | 改哪里 |
| --- | --- |
| 站点标题、主题色相、博客地址 | `src/config.ts` |
| 服务器、昵称 | `wows.config.json` |
| 配色变量、圆角、间距 | `src/styles/global.css` 顶部 `:root` |
| 指标口径、要展示哪些数据 | `scripts/fetch-wows.mjs` |

主题色相 `hue`：210 是海军蓝，360 是博客默认的粉，265 是紫。

## 数据说明

- 数据来自 Wargaming / 360 的公开开发者 API，只读，不涉及账号登录。
- 本站与 Wargaming、360 无任何关联。
- 战绩数据本身是公开信息，但如果是别人的号，建议先征得同意再展示。

## License

MIT
