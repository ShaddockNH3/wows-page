/**
 * Personal Rating（PR）计算。
 *
 * 公式与 wows-numbers 公开的口径完全一致，实现参照 wows-yuyuko/WowsApi 的
 * com.shinoaki.wows.api.pr.PrCalculation：
 *
 *   期望总伤害 = 场次 × 该船全服场均伤害
 *   期望总击杀 = 场次 × 该船全服场均击杀
 *   期望总胜场 = 场次 × 该船全服胜率
 *
 *   nd = 实际总伤害 / 期望总伤害
 *   nf = 实际总击杀 / 期望总击杀
 *   nw = 实际总胜场 / 期望总胜场
 *
 *   PR = 700 × max(0, (nd - 0.4) / 0.6)
 *      + 300 × max(0, (nf - 0.1) / 0.9)
 *      + 150 × max(0, (nw - 0.7) / 0.3)
 *
 * 基准值来自 wowsdb 采集的全服样本（约 49 万活跃账号、18 亿场随机战），
 * 由 scripts/fetch-baselines.mjs 抓取。
 */

import { readFileSync } from "node:fs";

const raw = JSON.parse(readFileSync(new URL("../src/data/baselines.json", import.meta.url), "utf8"));

/** 去掉「(金)」「(黑)」这类后缀，便于和国服船名对上 */
const stripSuffix = (name) => name.replace(/\s*[（(][^）)]*[）)]\s*$/, "").trim();

const byName = new Map();
const byTypeTier = new Map();

for (const ship of raw.ships) {
	for (const key of new Set([ship.name, stripSuffix(ship.name)])) {
		if (!byName.has(key)) byName.set(key, []);
		byName.get(key).push(ship);
	}
	const k = `${ship.type}:${ship.tier}`;
	if (!byTypeTier.has(k)) byTypeTier.set(k, []);
	byTypeTier.get(k).push(ship);
}

/** 同舰种同等级的加权平均，作为兜底基准 */
const fallback = new Map();
for (const [key, list] of byTypeTier) {
	const battles = list.reduce((a, s) => a + s.battles, 0) || 1;
	fallback.set(key, {
		name: key,
		tier: list[0].tier,
		type: list[0].type,
		battles,
		dmg: list.reduce((a, s) => a + s.dmg * s.battles, 0) / battles,
		frags: list.reduce((a, s) => a + s.frags * s.battles, 0) / battles,
		wr: list.reduce((a, s) => a + s.wr * s.battles, 0) / battles,
		surv: list.reduce((a, s) => a + s.surv * s.battles, 0) / battles,
		approximate: true,
	});
}

/** 找这艘船的全服基准：先按船名，再按「同舰种同等级」的平均值 */
export function findBaseline(ship) {
	const candidates = byName.get(ship.name) ?? byName.get(stripSuffix(ship.name)) ?? [];
	const exact = candidates.find((c) => c.tier === ship.tier && c.type === ship.type);
	if (exact) return exact;
	if (candidates.length === 1) return candidates[0];
	return fallback.get(`${ship.type}:${ship.tier}`) ?? null;
}

/** PR 分档，沿用 wows-numbers 的区间 */
export const PR_TIERS = [
	{ min: 2450, label: "超神", key: "super" },
	{ min: 2100, label: "顶尖", key: "elite" },
	{ min: 1750, label: "优秀", key: "great" },
	{ min: 1550, label: "良好", key: "good" },
	{ min: 1350, label: "不错", key: "above" },
	{ min: 1100, label: "平均", key: "average" },
	{ min: 750, label: "偏低", key: "below" },
	{ min: 0, label: "待提升", key: "low" },
];

export function prTier(pr) {
	if (pr == null) return PR_TIERS[PR_TIERS.length - 1];
	return PR_TIERS.find((t) => pr >= t.min) ?? PR_TIERS[PR_TIERS.length - 1];
}

/** 按 PR 原始公式算，传入的都是「总量」 */
function calcPr(actual, expected) {
	if (!expected.damage || !expected.frags || !expected.wins) return null;
	const nd = actual.damage / expected.damage;
	const nf = actual.frags / expected.frags;
	const nw = actual.wins / expected.wins;

	const maxNd = Math.max(0, (nd - 0.4) / 0.6);
	const maxNf = Math.max(0, (nf - 0.1) / 0.9);
	const maxNw = Math.max(0, (nw - 0.7) / 0.3);

	return {
		pr: Math.round(700 * maxNd + 300 * maxNf + 150 * maxNw),
		ratios: { damage: nd, frags: nf, wins: nw },
	};
}

/** 单船 PR */
export function scoreShip(ship) {
	const baseline = findBaseline(ship);
	if (!baseline || ship.battles < 2) {
		return { pr: null, tier: null, label: null, baseline, parts: null };
	}
	const actual = { damage: ship.damage, frags: ship.frags, wins: ship.wins };
	const expected = {
		damage: ship.battles * baseline.dmg,
		frags: ship.battles * baseline.frags,
		wins: ship.battles * baseline.wr,
	};
	const result = calcPr(actual, expected);
	if (!result) return { pr: null, tier: null, label: null, baseline, parts: null };

	const tier = prTier(result.pr);
	return {
		pr: result.pr,
		tier: tier.key,
		label: tier.label,
		baseline,
		parts: {
			damage: Math.round((result.ratios.damage - 1) * 100),
			frags: Math.round((result.ratios.frags - 1) * 100),
			wins: Math.round((result.ratios.wins - 1) * 100),
		},
	};
}

/**
 * 账号总 PR：把各船的实际值与期望值分别求和，再套一次公式。
 * 和 wows-numbers / Yuyuko 的 shipList 做法一致，不是各船 PR 取平均。
 */
export function scoreAccount(ships) {
	const actual = { damage: 0, frags: 0, wins: 0 };
	const expected = { damage: 0, frags: 0, wins: 0 };
	let battles = 0;

	for (const s of ships) {
		const b = findBaseline(s);
		if (!b || s.battles < 2) continue;
		actual.damage += s.damage;
		actual.frags += s.frags;
		actual.wins += s.wins;
		expected.damage += s.battles * b.dmg;
		expected.frags += s.battles * b.frags;
		expected.wins += s.battles * b.wr;
		battles += s.battles;
	}

	const result = calcPr(actual, expected);
	if (!result) return { pr: null, tier: null, label: null, countedBattles: 0 };
	const tier = prTier(result.pr);
	return {
		pr: result.pr,
		tier: tier.key,
		label: tier.label,
		countedBattles: battles,
		ratios: {
			damage: Math.round((result.ratios.damage - 1) * 100),
			frags: Math.round((result.ratios.frags - 1) * 100),
			wins: Math.round((result.ratios.wins - 1) * 100),
		},
	};
}

export function baselineMeta() {
	return { source: raw.source, fetchedAt: raw.fetchedAt, ships: raw.ships.length };
}
