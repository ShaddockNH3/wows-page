# wows-page

一个静态的《战舰世界》个人战绩页面 —— 展示自己的账号数据，风格对齐 [Firefly](https://github.com/Cydiar/Firefly) 博客主题。

![总览页](docs/preview-pr.jpg)

![舰船页](docs/preview-ships.jpg)

- 纯静态：构建期就把数据抓成 JSON，运行时零请求、零 key
- 无框架运行时：Astro + 手写 CSS，产物只有几十 KB
- **两种用法**：嵌进 Firefly 博客一起构建（主题跟随博客），或自己单独跑一个站
- **两套配色**（独立部署时）：`blog`（跟博客主题色一致）和 `wows`（海军蓝），导航栏一键切换
- 深浅色、响应式、可筛选的逐船战绩表
- 不改动博客本体，页面组件与外壳完全解耦

## 页面

| 路由 | 内容 |
| --- | --- |
| `/` | 账号总览：核心指标、舰种/等级分布、主力舰船、个人纪录、最近出港 |
| `/ships` | 逐船战绩表：搜索、按舰种/等级筛选、点表头排序 |

## 快速开始

```bash
pnpm install

# 1. 改 wows.config.json，填服务器和昵称（默认就是国服）
#    { "realm": "cn", "nickname": "你的游戏ID" }

# 2. 抓数据 —— 国服不需要任何 key
pnpm fetch

# 3. 本地预览
pnpm dev        # http://localhost:4321
pnpm build      # 产物在 dist/
```

### 关于 key：国服不用，国际服要

| 服务器 | 通道 | 需要申请吗 |
| --- | --- | --- |
| **国服（360）** | Vortex 公开接口 `vortex.wowsgame.cn` | **不需要**，`pnpm fetch` 直接跑 |
| 亚服 / 欧服 / 美服 / 俄服 | 官方 API | 需要，到 https://developers.wargaming.net/applications/ 免费申请 |

国服走的是和官网图鉴同一套 Vortex 接口（搜索、账号、单船、舰船图鉴），版本号都跟着客户端走；
国际服走官方 API，把申请到的 id 放环境变量即可：

```bash
WOWS_APP_ID=xxxx WOWS_NICKNAME=你的ID WOWS_REALM=asia pnpm fetch
```

优先级：环境变量 > `wows.config.json`。国服的 `developers.wggames.cn`（360 的开发者站）常年
打不开，所以压根没依赖它。

### 仓库里这份示例数据

`src/data/*.json` 是构建产物，直接提交进仓库（这样 CI 不依赖 key 也能构建）。
当前这份是国服号 `凉柚NH3` 的数据，跑一次 `pnpm fetch` 就会按配置重新生成。

### 定时更新数据

`.github/workflows/update-data.yml` 每周一凌晨跑一次抓取并提交 `src/data`：
- 国服不需要任何 Secrets，默认配置直接能跑
- 国际服需要在仓库 Secrets 里配 `WOWS_APP_ID`、`WOWS_NICKNAME`（`WOWS_REALM` 可选）

不启用也没关系，数据会停在最后一次手动抓取的状态。

## 部署

两种用法：**嵌进 Firefly 博客一起构建**（推荐），或者**自己单独跑一个站**。

### 一、嵌进 Firefly 博客（参与博客构建）

页面会走博客自己的三栏网格，导航、壁纸、侧栏、页脚、转场全是博客的，主题色也跟随博客的
`--hue`，视觉上就是博客里多了一页。

![嵌进博客后的总览页](docs/embed-home.jpg)

![嵌进博客后的舰船页](docs/embed-ships.jpg)

```bash
# 在 wows-page 目录里，指向你的博客仓库
pnpm sync /path/to/Firefly
```

会写入这几处（其它文件一律不动）：

```
<blog>/src/wows/{views,components,styles,data,utils}
<blog>/src/pages/wows/{index,ships}.astro
```

然后在博客的 `src/config/navBarConfig.ts` 里加一项导航（`pnpm sync` 结束时也会把这段打出来）：

```ts
{
	name: "舰长档案",
	url: "/wows/",
	icon: "material-symbols:anchor",
},
```

就完了。`pnpm build` 博客时这两个页面会一起构建。

几点说明：

- 页面壳用 `MainGridLayout`，所以内容在中间列。宽度大概是这样：1920 屏约 980px，1440 屏约 700px，1080 屏约 530px
- 排版断点按**内容列**宽度算（CSS 容器查询），不是按浏览器窗口。所以窗口缩放、侧栏伸缩都能自适应：
  6 张指标卡在 >900px 时一行放完，以下转 3 列，再窄转 2 列；舰船表最窄处还是会横向滚动，这是 7 列的代价
- 内容外面套了 `wows-scope wows-scope--plain`：`--plain` 表示不抢博客的壁纸和字体，只用组件自己的皮
- 配色继承博客的 `--hue`，那套「玫粉 / 海军蓝」的双主题在博客里不生效（博客说了算）
- 数据改动后重新 `pnpm fetch && pnpm sync` 即可

### 二、独立部署

自己跑一个站，带自己的导航、页脚和双主题。

**Vercel / Cloudflare Pages**：框架预设选 Astro，构建命令 `pnpm build`，输出目录 `dist`。
私有仓库也能连，这是最省事的路。

**GitHub Pages**：`.github/workflows/deploy.yml` 已经写好了，每次 push 自动构建发布。
但注意 Pages 对**私有仓库**要 Pro 才有，仓库公开才能免费用；项目站点会自动把 `BASE_PATH`
设成 `/<repo>`，绑自定义域名的话把它改成 `/`。

导航栏的「博客」按钮指回博客，改 `src/config.ts` 的 `blogUrl`。

## 想要 iframe 那种最省事的

如果哪天不想参与构建了，也可以把独立部署的地址用 iframe 塞进任意页面，主题用 URL 参数对齐：

```
https://你的站/?palette=wows&theme=dark
```

缺点是要多维护一个站，而且博客的深浅色切换不会自动同步过去。

两种都不需要改博客的代码。

## 自定义

| 想改什么 | 改哪里 |
| --- | --- |
| 站点标题、默认主题、博客地址 | `src/config.ts` |
| 两套配色的色相 | `src/config.ts` 的 `themes` |
| 服务器、昵称 | `wows.config.json` |
| 配色变量、圆角、间距 | `src/styles/global.css` 顶部 `:root` |
| 指标口径、要展示哪些数据 | `scripts/fetch-wows.mjs` |

### 两套配色

| key | 色相 | 说明 |
| --- | --- | --- |
| `blog` | 360 | 玫粉，跟博客的 `themeColor.hue` 一致，默认 |
| `wows` | 210 | 海军蓝，更贴近游戏，圆角也收紧一点 |

导航栏那枚调色盘按钮切换，选完写进 `localStorage`，下次进来还是这套。
想加第三套就往 `themes` 里加一行，`data-theme` 会自动生成对应的 `--hue`。
URL 参数也能直接指定：`/?palette=wows`、`/?theme=light`，方便给别人看某个特定状态。

### 国服和国际服的数据差异

| | 国服（Vortex） | 国际服（官方 API） |
| --- | --- | --- |
| 申请 key | 不需要 | 需要 |
| 逐船最后战斗时间 | 接口没有，「最近出港」自动换成「武备效率」 | 有 |
| 舰船图鉴 | GraphQL 全量拿，版本跟客户端 | 官方 encyclopedia 接口 |

## PR 评分是怎么算的

页面上的 PR 不是自己编的，用的就是 **wows-numbers 公开的那套 Personal Rating 口径**，
实现照着 [wows-yuyuko/WowsApi](https://github.com/wows-yuyuko/WowsApi) 里
`com.shinoaki.wows.api.pr.PrCalculation` 写的：

```
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

账号总 PR 是把各船的实际值和期望值分别求和后再套一次公式（和 wows-numbers、
Yuyuko 的 `shipList` 一样），不是把每艘船的 PR 取平均。

**基准值从哪来**：wows-numbers 的期望值接口被 Cloudflare 挡着，所以改用
[wowsdb](https://wowsdb.com/zh-CN/player/rating) 采集的全服样本（约 49 万活跃账号、
18 亿场随机战），那边明写着「公式、权重、基准值都在这一页，欢迎复算」。
`scripts/fetch-baselines.mjs` 把页底那张基准表抓成本地 `src/data/baselines.json`，
约 4 周更新一次就够了：

```bash
pnpm baselines
```

找不到同名船时（比如国服特有船），退到「同舰种同等级」的全服加权平均，页面上不额外标注。

分档沿用 wows-numbers 的区间：<750 待提升 / 750-1100 偏低 / 1100-1350 平均 /
1350-1550 不错 / 1550-1750 良好 / 1750-2100 优秀 / 2100-2450 顶尖 / 2450+ 超神。

> 国服和国际服的环境、船池、玩家分布都不一样，同一套基准套上去数值会有偏差（通常偏低）。
> 看趋势比看绝对值靠谱。

## 筛选

舰船页支持四种条件叠加：

- 搜索：中文名 / 英文名
- 舰种：全部 / 驱逐 / 巡洋 / 战列 / 航母 / 潜艇（带颜色的 chip）
- 等级：Tier 2 ~ 11
- 国籍：按国服叫法（Y 系、R 系、M 系……），下拉里带各自的场次

排序可以点表头，也可以用下拉：PR / 场次 / 胜率 / 场均伤害 / 场均击杀 / 生存率 / 场均经验。

## 数据说明

- 数据来自 Wargaming / 360 的公开开发者 API，只读，不涉及账号登录。
- 本站与 Wargaming、360 无任何关联。
- 战绩数据本身是公开信息，但如果是别人的号，建议先征得同意再展示。

## License

MIT
