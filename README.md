# wows-page

一个《战舰世界》个人战绩的静态页面，视觉上对齐 [Firefly](https://github.com/Cydiar/Firefly) 博客主题。

项目有两种用法：直接参与博客构建，作为博客里的一页存在；或者单独构建成一个独立站点。所有数据在构建期抓成 JSON，运行时不发请求，也不需要任何密钥。

![总览页](docs/preview-pr.jpg)

![舰船页](docs/preview-ships.jpg)

## 功能清单

- 账号总览：核心指标、PR 评分、舰种与等级分布、主力舰船、个人纪录
- 逐船战绩表：搜索中英文船名，按舰种 / 等级 / 国籍筛选，点表头或下拉排序
- PR 评分：wows-numbers 口径，基准取自全服样本
- 深浅色，响应式，排版断点按内容列宽度计算
- 两套配色（独立部署时生效）：与博客一致的玫粉，或更贴近游戏的海军蓝
- 纯静态：构建产物约 80KB，无前端框架运行时

## 项目结构

```text
wows-page/
├─ scripts/
│  ├─ fetch-wows.mjs        # 抓账号与逐船战绩，按服务器自动路由
│  ├─ fetch-baselines.mjs   # 抓全服基准（PR 用）
│  ├─ scoring.mjs           # PR 公式
│  └─ sync-to-blog.mjs      # 同步进 Firefly 博客
├─ src/
│  ├─ views/                # 可嵌入的页面组件，只有内容
│  ├─ pages/                # 独立站点的薄壳
│  ├─ components/           # 导航、页脚、自定义下拉
│  ├─ styles/global.css     # 全部样式，收在 .wows-scope 作用域内
│  ├─ data/                 # 抓取产物：profile / ships / meta / baselines
│  └─ config.ts             # 站点标题、配色、博客地址
├─ wows.config.json         # 服务器与昵称
└─ docs/                    # README 配图
```

## 快速开始

需要 Node.js 20 及以上，包管理器使用 pnpm。

```bash
pnpm install
```

### 配置服务器与昵称

编辑 `wows.config.json`：

```json
{
	"realm": "cn",
	"nickname": "你的游戏 ID",
	"appId": ""
}
```

`realm` 可选 `cn` / `asia` / `eu` / `na` / `ru`。`appId` 只有国际服才需要填，国服留空即可。

### 抓取数据

```bash
pnpm fetch
```

产物写入 `src/data/`，包括账号总览、逐船战绩、抓取时间和基准表。这一步会联网，其它命令不会。

> [!TIP]
> 只是本地看看的话，改完 `wows.config.json` 直接 `pnpm fetch && pnpm dev` 就行，不必先构建。
>
> 抓取到的 JSON 是提交进仓库的，所以 CI 不依赖网络也能构建。

### 本地预览

```bash
pnpm dev      # http://localhost:4321
pnpm build    # 产物在 dist/
```

## 数据来源

| 服务器 | 通道 | 是否需要 key |
| ------ | ---------------------------------------- | ------------ |
| 国服（360） | Vortex 公开接口 `vortex.wowsgame.cn` | 不需要 |
| 亚服 / 欧服 / 美服 / 俄服 | 官方 API | 需要 |

国服走的是与官网图鉴同一套接口：搜索、账号、逐船战绩、舰船图鉴（GraphQL 全量 1044 艘）都能拿到，版本号跟着客户端走。

> [!NOTE]
> 国服的 `developers.wggames.cn`（360 开发者站）常年打不开，因此这个项目完全没依赖它，`pnpm fetch` 开箱即用。

国际服走官方 API，把申请到的 id 放环境变量即可：

```bash
WOWS_APP_ID=xxxx WOWS_NICKNAME=你的ID WOWS_REALM=asia pnpm fetch
```

优先级：环境变量 > `wows.config.json`。国际服的 application_id 在 <https://developers.wargaming.net/applications/> 免费申请。

> [!WARNING]
> 国服与国际服的 application_id 不通用。用亚服申请到的 key 查不到国服数据，换服需要重新申请。

### 两种数据源的差异

| 项目 | 国服（Vortex） | 国际服（官方 API） |
| -------------- | -------------------------------------- | ---------------------------- |
| 申请 key | 不需要 | 需要 |
| 逐船最后战斗时间 | 接口没有，「最近出港」自动换成「武备效率」 | 有 |
| 舰船图鉴 | GraphQL 全量获取，版本跟客户端 | 官方 encyclopedia 接口 |

这些差异在前端是自动适配的，换服不需要改代码。

### 定时更新

`.github/workflows/update-data.yml` 每周一凌晨抓取一次并提交 `src/data`：

- 国服不需要任何 Secrets，默认配置直接能跑
- 国际服需要在仓库 Secrets 里配置 `WOWS_APP_ID`、`WOWS_NICKNAME`，`WOWS_REALM` 可选

不启用也一样，数据会停在上一次手动抓取的快照。

> [!TIP]
> 建议把这个 Action 打开。战绩是慢慢堆起来的，每周自动抓一次，省得想起来才手动跑。

## PR 评分

页面上的 PR 不是自编的算法，而是 **wows-numbers 公开的 Personal Rating 口径**，实现照着 [wows-yuyuko/WowsApi](https://github.com/wows-yuyuko/WowsApi) 里的 `com.shinoaki.wows.api.pr.PrCalculation` 写：

```text
期望总伤害 = 场次 × 该船全服场均伤害
期望总击杀 = 场次 × 该船全服场均击杀
期望总胜场 = 场次 × 该船全服胜率

nd = 实际总伤害 / 期望总伤害
nf = 实际总击杀 / 期望总击杀
nw = 实际总胜场 / 期望总胜场

PR = 700 × max(0, (nd - 0.4) / 0.6)
   + 300 × max(0, (nf - 0.1) / 0.9)
   + 150 × max(0, (nw - 0.7) / 0.3)
```

账号总 PR 是把各船的实际值与期望值分别求和后再套一次公式，与 wows-numbers、Yuyuko 的 `shipList` 一致，不是把每条船的 PR 取平均。

### 基准值来源

wows-numbers 的期望值接口被 Cloudflare 挡着，因此改用 [wowsdb](https://wowsdb.com/zh-CN/player/rating) 采集的全服样本，约 49 万活跃账号、18 亿场随机战。`scripts/fetch-baselines.mjs` 把页面里的基准表抓成本地 `src/data/baselines.json`：

```bash
pnpm baselines
```

基准变化很慢，四周更新一次足够。找不到同名船时（例如国服特有船），退到同舰种同等级的全服加权平均。

### 分档

沿用 wows-numbers 的区间：

| 分数 | 档位 |
| ------------ | -------- |
| 2450 以上 | 超神 |
| 2100 - 2450 | 顶尖 |
| 1750 - 2100 | 优秀 |
| 1550 - 1750 | 良好 |
| 1350 - 1550 | 不错 |
| 1100 - 1350 | 平均 |
| 750 - 1100 | 偏低 |
| 750 以下 | 待提升 |

> [!WARNING]
> 国服与国际服的船池、玩家分布都不一样，同一套基准套上去数值会有偏差（通常偏低）。看趋势比看绝对值靠谱。

## 接入 Firefly 博客

推荐用法。页面会走博客自己的三栏网格，导航、壁纸、侧栏、页脚、转场都是博客的，主题色跟随博客的 `--hue`，视觉上就是博客里多了一页。

![嵌进博客后的总览页](docs/embed-home.jpg)

![嵌进博客后的舰船页](docs/embed-ships.jpg)

### 同步

在 wows-page 目录里执行，参数指向博客仓库：

```bash
pnpm sync /path/to/Firefly
```

会写入以下位置，博客的其它文件一律不动：

```text
<blog>/src/wows/{views,components,styles,data,utils}
<blog>/src/pages/wows/{index,ships}.astro
```

脚本结束时会清掉博客的 `.astro` 缓存。Astro 的增量缓存认不出「文件被外部覆盖」，不清的话下一次构建会沿用旧的编译结果。

### 加导航

在博客的 `src/config/navBarConfig.ts` 里加一项，`pnpm sync` 结束时会把这行打印出来：

```ts
{
	name: "舰长档案",
	url: "/wows/",
	icon: "material-symbols:anchor",
}
```

之后博客 `pnpm build` 时这两个页面会一起构建。

### 几点说明

- 页面壳用 `MainGridLayout`，内容在中间列。1920 屏约 980px，1440 屏约 700px，1080 屏约 530px
- 断点按内容列宽度算（CSS 容器查询），不按浏览器窗口，所以窗口缩放与侧栏伸缩都能自适应
- 6 张指标卡在 900px 以上一行放完，以下转 3 列，再窄转 2 列
- 舰船表列多（8 列，国际服多一列最后出战），最窄处仍会横向滚动
- 内容外层是 `wows-scope wows-scope--plain`，`--plain` 表示不抢博客的壁纸与字体
- 两套配色在博客里不生效，颜色由博客决定
- 数据更新后重新 `pnpm fetch && pnpm sync` 即可

## 独立部署

自己跑一个站，带独立导航、页脚与双主题。

### Vercel / Cloudflare Pages

框架预设选 Astro，构建命令 `pnpm build`，输出目录 `dist`。私有仓库也能连，这是最省事的方式。

### GitHub Pages

`.github/workflows/deploy.yml` 已经写好，每次 push 自动构建发布。项目站点会自动把 `BASE_PATH` 设成 `/<repo>`，绑定自定义域名时改成 `/`。

> [!NOTE]
> GitHub Pages 对私有仓库需要 Pro 订阅，仓库公开才能免费使用。

导航栏的「博客」按钮指回博客，修改 `src/config.ts` 的 `blogUrl`。

## 自定义

| 想改什么 | 改哪里 |
| -------------------- | --------------------------------- |
| 站点标题、默认主题、博客地址 | `src/config.ts` |
| 两套配色的色相 | `src/config.ts` 的 `themes` |
| 服务器、昵称 | `wows.config.json` |
| 配色变量、圆角、间距 | `src/styles/global.css` 顶部 |
| 指标口径、要展示哪些数据 | `scripts/fetch-wows.mjs` |

### 两套配色

| key | 色相 | 说明 |
| ----- | ---- | -------------------------------------- |
| `blog` | 360 | 玫粉，与博客 `themeColor.hue` 一致，默认 |
| `wows` | 210 | 海军蓝，更贴近游戏，圆角也收紧一点 |

导航栏的调色盘按钮切换，选择写入 `localStorage`。想加第三套就在 `themes` 里加一行。

> [!TIP]
> 色相就是一个 0 到 360 的数字，改完刷新就能看到效果，不用重新抓数据。

URL 参数也能直接指定，方便分享某个特定状态：

```text
/?palette=wows
/?theme=light
```

### 筛选

舰船页支持四种条件叠加：

- 搜索：中文名 / 英文名
- 舰种：全部 / 驱逐 / 巡洋 / 战列 / 航母 / 潜艇，带颜色的 chip
- 等级：Tier 2 至 11
- 国籍：按国服叫法（Y 系、R 系、M 系），下拉里带各自场次

排序可以点表头，也可以用下拉：PR / 场次 / 胜率 / 场均伤害 / 场均击杀 / 生存率 / 场均经验。

> [!NOTE]
> 原生 `<select>` 的展开列表由操作系统绘制，CSS 改不动，深色页面里会弹出一块系统灰。所以这里自己写了 `Select.astro`，胶囊按钮加卡片式面板，配色走 `--wows-*` 变量。

## 说明

- 数据来自 Wargaming / 360 的公开接口，只读，不涉及账号登录
- 本项目与 Wargaming、360 无任何关联
- 战绩本身是公开信息，但展示他人账号前，建议先征得同意

## License

MIT
