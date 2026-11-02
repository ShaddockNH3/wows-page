#!/usr/bin/env node
/**
 * 把视图、样式、数据同步进 Firefly 博客，并生成两个页面壳。
 *
 * 用法：
 *   node scripts/sync-to-blog.mjs ../Firefly
 *   FIREFLY_DIR=../Firefly node scripts/sync-to-blog.mjs
 *
 * 只会写这几处：
 *   <blog>/src/wows/{views,styles,data,utils}
 *   <blog>/src/pages/wows/{index,ships}.astro
 * 其余文件一律不动。
 */

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const target = path.resolve(ROOT, process.argv[2] || process.env.FIREFLY_DIR || "../Firefly");

const wowsDir = path.join(target, "src", "wows");
const pagesDir = path.join(target, "src", "pages", "wows");

const PROFILE_PAGE = `---
import MainGridLayout from "@/layouts/MainGridLayout.astro";
import ProfileView from "@/wows/views/ProfileView.astro";
import profile from "@/wows/data/profile.json";
import "@/wows/styles/global.css";

const title = "舰长档案";
const description = \`\${profile.nickname} 的战舰世界战绩，\${profile.realmLabel}。\`;
---

<MainGridLayout title={title} description={description} heading={title}>
	<div class="wows-scope wows-scope--plain">
		<ProfileView basePath="/wows" />
	</div>
</MainGridLayout>
`;

const SHIPS_PAGE = `---
import MainGridLayout from "@/layouts/MainGridLayout.astro";
import ShipsView from "@/wows/views/ShipsView.astro";
import profile from "@/wows/data/profile.json";
import "@/wows/styles/global.css";

const title = "舰船战绩";
const description = \`\${profile.nickname} 的逐船战绩。\`;
---

<MainGridLayout title={title} description={description} heading={title}>
	<div class="wows-scope wows-scope--plain">
		<ShipsView basePath="/wows" />
	</div>
</MainGridLayout>
`;

async function main() {
	console.log(`→ 同步到 ${target}`);

	await rm(wowsDir, { recursive: true, force: true });
	await mkdir(path.join(wowsDir, "styles"), { recursive: true });
	await mkdir(path.join(wowsDir, "utils"), { recursive: true });

	await cp(path.join(ROOT, "src", "views"), path.join(wowsDir, "views"), { recursive: true });
	await cp(path.join(ROOT, "src", "components"), path.join(wowsDir, "components"), { recursive: true });
	await cp(path.join(ROOT, "src", "components"), path.join(wowsDir, "components"), { recursive: true });
	await cp(path.join(ROOT, "src", "data"), path.join(wowsDir, "data"), { recursive: true });
	await cp(path.join(ROOT, "src", "styles", "global.css"), path.join(wowsDir, "styles", "global.css"));
	await cp(path.join(ROOT, "src", "utils", "format.ts"), path.join(wowsDir, "utils", "format.ts"));

	await mkdir(pagesDir, { recursive: true });
	await writeFile(path.join(pagesDir, "index.astro"), PROFILE_PAGE);
	await writeFile(path.join(pagesDir, "ships.astro"), SHIPS_PAGE);

	console.log("✓ 完成：src/wows/ 与 src/pages/wows/ 已更新");
	console.log("  记得在 navBarConfig.ts 里加导航项：");
	console.log('  { name: "舰长档案", url: "/wows/", icon: "material-symbols:anchor" }');
}

main().catch((e) => {
	console.error("✗ 同步失败：", e.message);
	process.exit(1);
});
