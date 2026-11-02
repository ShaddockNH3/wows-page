#!/usr/bin/env node
/**
 * 抓取每艘船的全服基准（场均伤害 / 击杀 / 胜率 / 存活率），供 PR 计算使用。
 *
 * 数据来源：https://wowsdb.com/zh-CN/player/rating
 * 那是用 48 万活跃账号、18 亿场随机战统计出来的，页面上写着「公式、权重、基准值都在这一页，欢迎复算」。
 * 这里只是把页底那张基准表抓下来存成本地 JSON，不做任何加工。
 *
 * 用法：
 *   pnpm baselines
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "src", "data", "baselines.json");
const SOURCE = "https://wowsdb.com/zh-CN/player/rating";

async function main() {
	console.log(`→ 抓取基准表 ${SOURCE}`);
	const res = await fetch(SOURCE, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
			"Accept-Language": "zh-CN,zh;q=0.9",
		},
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const html = await res.text();

	// Next.js 的 RSC 流，数据藏在 self.__next_f.push([1,"..."]) 里
	const parts = [];
	for (const m of html.matchAll(/self\.__next_f\.push\((\[1,".*?"\])\)/g)) {
		try {
			parts.push(JSON.parse(m[1])[1]);
		} catch {
			// 跳过解析不了的片段
		}
	}
	const blob = parts.join("");
	const rows = blob.match(/"rows":\[(\{.*?\})\]/s);
	if (!rows) throw new Error("页面里没找到 rows，可能站点结构变了");
	const arr = JSON.parse(`[${rows[1]}]`);

	const slim = arr.map((s) => ({
		id: s.id,
		name: s.name,
		tier: s.tier,
		type: s.type,
		battles: s.battles,
		dmg: s.dmg,
		frags: s.frags,
		wr: s.wr,
		surv: s.surv,
	}));

	await mkdir(path.dirname(OUT), { recursive: true });
	await writeFile(
		OUT,
		`${JSON.stringify({ source: SOURCE, fetchedAt: new Date().toISOString(), ships: slim }, null, "\t")}\n`,
	);

	console.log(`✓ 完成：${slim.length} 艘船的基准已写入 src/data/baselines.json`);
}

main().catch((e) => {
	console.error("✗ 抓取失败：", e.message);
	process.exit(1);
});
