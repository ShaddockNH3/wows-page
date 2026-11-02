#!/usr/bin/env node
/**
 * 抓取《战舰世界》玩家档案，生成静态数据文件。
 *
 * 两条通道：
 *   国服（cn）…… Vortex 公开接口，不需要 application_id
 *   国际服……     官方 API，需要 application_id（developers.wargaming.net 申请）
 *
 * 用法：
 *   pnpm fetch                          （读 wows.config.json）
 *   WOWS_NICKNAME=凉柚NH3 pnpm fetch
 *   WOWS_APP_ID=xxx WOWS_REALM=asia pnpm fetch
 *
 * 产物：
 *   src/data/profile.json  账号总览
 *   src/data/ships.json    单船战绩
 *   src/data/meta.json     数据版本与生成时间
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const CACHE_DIR = path.join(ROOT, ".cache");

/** 亚服开发用的公共 id，仅作演示，正式部署请换成自己的 */
const FALLBACK_APP_ID = "ab69ce1bc38671074dc4bdc67b3645c7";

const OFFICIAL_API = {
	asia: "api.worldofwarships.asia",
	eu: "api.worldofwarships.eu",
	na: "api.worldofwarships.com",
	ru: "api.worldofwarships.ru",
};
const OFFICIAL_ROOM = {
	asia: "https://developers.wargaming.net/applications/",
	eu: "https://developers.wargaming.net/applications/",
	na: "https://developers.wargaming.net/applications/",
	ru: "https://developers.wargaming.net/applications/",
	cn: "https://developers.wggames.cn/",
};
const VORTEX_HOST = { cn: "vortex.wowsgame.cn" };
const REALM_LABEL = { asia: "亚服", eu: "欧服", na: "美服", ru: "俄服", cn: "国服" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const ratio = (a, b, digits = 4) => (b > 0 ? Number((a / b).toFixed(digits)) : 0);

/* ------------------------------------------------------------------ */
/* 配置                                                                */
/* ------------------------------------------------------------------ */

async function loadConfig() {
	let file = {};
	try {
		file = JSON.parse(await readFile(path.join(ROOT, "wows.config.json"), "utf8"));
	} catch {
		// 没有配置文件就用默认值
	}
	const realm = (process.env.WOWS_REALM || file.realm || "cn").toLowerCase();
	const appId = process.env.WOWS_APP_ID || file.appId || (realm === "asia" ? FALLBACK_APP_ID : "");
	return {
		realm,
		nickname: process.env.WOWS_NICKNAME || file.nickname || "",
		appId,
	};
}

/* ------------------------------------------------------------------ */
/* 统计归一化 —— 两个通道都收敛到同一个形状                             */
/* ------------------------------------------------------------------ */

function normalize(block) {
	const battles = num(block.battles ?? block.battles_count);
	const wins = num(block.wins);
	const survived = num(block.survived ?? block.survived_battles);
	const frags = num(block.frags);
	const damage = num(block.damage_dealt);
	const xp = num(block.exp ?? block.xp);
	const shots = num(block.shots_by_main ?? block.main_battery?.shots);
	const hits = num(block.hits_by_main ?? block.main_battery?.hits);
	const torpShots = num(block.shots_by_tpd ?? block.torpedoes?.shots);
	const torpHits = num(block.hits_by_tpd ?? block.torpedoes?.hits);

	return {
		battles,
		wins,
		losses: num(block.losses),
		draws: num(block.draws),
		winrate: ratio(wins, battles),
		damage,
		avgDamage: Math.round(ratio(damage, battles, 0)),
		frags,
		avgFrags: ratio(frags, battles, 2),
		kd: ratio(frags, Math.max(1, battles - survived), 2),
		survival: ratio(survived, battles),
		xp,
		avgXp: Math.round(ratio(xp, battles, 0)),
		hitRate: ratio(hits, shots),
		mainShots: shots,
		mainHits: hits,
		torpedoShots: torpShots,
		torpedoHits: torpHits,
		torpedoHitRate: ratio(torpHits, torpShots),
		planesKilled: num(block.planes_killed),
		shipsSpotted: num(block.ships_spotted),
		capturePoints: num(block.capture_points),
		maxDamage: num(block.max_damage_dealt),
		maxFrags: num(block.max_frags ?? block.max_frags_battle),
		maxXp: num(block.max_exp ?? block.max_xp),
		maxPlanesKilled: num(block.max_planes_killed),
	};
}

function finishDistribution(obj) {
	return Object.values(obj)
		.map((d) => ({
			...d,
			winrate: ratio(d.wins, d.battles),
			avgDamage: Math.round(ratio(d.damage, d.battles, 0)),
		}))
		.sort((a, b) => b.battles - a.battles);
}

function accumulate(rows) {
	const byType = {};
	const byNation = {};
	const byTier = {};
	for (const s of rows) {
		const t = (byType[s.type] ??= { key: s.type, label: s.typeLabel, battles: 0, wins: 0, damage: 0, ships: 0 });
		const n = (byNation[s.nation] ??= { key: s.nation, label: s.nationLabel, battles: 0, wins: 0, damage: 0, ships: 0 });
		const tier = (byTier[s.tier] ??= { tier: s.tier, battles: 0, wins: 0, damage: 0, ships: 0 });
		for (const box of [t, n, tier]) {
			box.battles += s.battles;
			box.wins += s.wins;
			box.damage += s.damage;
			box.ships += 1;
		}
	}
	return {
		byType: finishDistribution(byType),
		byNation: finishDistribution(byNation),
		byTier: finishDistribution(byTier).sort((a, b) => a.tier - b.tier),
	};
}

function buildProfile({ nickname, accountId, realm, createdAt, lastBattleAt, levelingTier, hidden, pvp, ranked, ships, gameVersion }) {
	const best = (arr, key, minBattles = 0) =>
		arr.filter((s) => s.battles >= minBattles).sort((a, b) => b[key] - a[key])[0] ?? null;

	return {
		nickname,
		accountId,
		realm,
		realmLabel: REALM_LABEL[realm] ?? realm,
		createdAt: Math.round(num(createdAt)),
		lastBattleAt: Math.round(num(lastBattleAt)),
		levelingTier: levelingTier ?? null,
		karma: null,
		hiddenProfile: Boolean(hidden),
		gameVersion: gameVersion ?? null,
		pvp,
		ranked: ranked && ranked.battles > 0 ? ranked : null,
		shipCount: ships.length,
		topShip: ships[0] ? { name: ships[0].name, battles: ships[0].battles, winrate: ships[0].winrate } : null,
		bestWinrateShip: best(ships, "winrate", 8),
		bestDamageShip: best(ships, "avgDamage"),
		...accumulate(ships),
	};
}

/* ------------------------------------------------------------------ */
/* 通用请求                                                            */
/* ------------------------------------------------------------------ */

async function fetchJson(url, init = {}, attempt = 0) {
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "wows-page/1.0 (+https://github.com/ShaddockNH3/wows-page)", ...(init.headers ?? {}) },
			...init,
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const json = await res.json();
		if (json?.status === "error") {
			const err = json.error ?? {};
			const code = typeof err === "object" ? err.code : "?";
			const msg = typeof err === "object" ? err.message : err;
			if (/REQUEST_LIMIT|503/i.test(String(msg))) {
				throw Object.assign(new Error(`限流：${msg}`), { retry: true });
			}
			throw new Error(`${code} ${msg ?? "unknown error"}`);
		}
		// 官方 API / Vortex / GraphQL 的有效载荷都在 data 字段里
		return json && typeof json === "object" && "data" in json ? json.data : json;
	} catch (e) {
		if (attempt < 3) {
			await sleep(1200 * (attempt + 1));
			return fetchJson(url, init, attempt + 1);
		}
		throw e;
	}
}

/* ------------------------------------------------------------------ */
/* 国服（Vortex，无需 key）                                            */
/* ------------------------------------------------------------------ */

const TYPE_NAME_MAP = {
	destroyer: "Destroyer",
	cruiser: "Cruiser",
	battleship: "Battleship",
	aircarrier: "AirCarrier",
	submarine: "Submarine",
};

async function loadCnGlossary(base) {
	const cacheFile = path.join(CACHE_DIR, "vortex-gloss-cn.json");
	try {
		const s = await stat(cacheFile);
		if (Date.now() - s.mtimeMs < 7 * 86_400_000) {
			// 旧缓存可能存的是整个响应（带 data 包装），统一剥出来
			const cached = JSON.parse(await readFile(cacheFile, "utf8"));
			return cached?.data ?? cached;
		}
	} catch {
		// 没有缓存
	}
	const body = {
		operationName: "getGlossData",
		variables: { lang: "zh-cn" },
		query:
			"query getGlossData($lang: String) { version vehicles(lang: $lang) { isPremium isSpecial id title titleShort icons { large medium small } type { name title } level nation { name title } } }",
	};
	const json = await fetchJson(`${base}/api/graphql/glossary/`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	await mkdir(CACHE_DIR, { recursive: true });
	await writeFile(cacheFile, JSON.stringify(json));
	return json;
}

async function fetchCn(cfg) {
	const base = `https://${VORTEX_HOST[cfg.realm]}`;
	const get = (path) => fetchJson(`${base}${path}`);
	console.log(`→ 国服 Vortex，昵称 ${cfg.nickname}`);

	// 1. 搜索
	const list = (await get(`/api/accounts/search/autocomplete/${encodeURIComponent(cfg.nickname)}/`)) ?? [];
	const exact = list.find((a) => a.name.toLowerCase() === cfg.nickname.toLowerCase());
	if (!exact) {
		console.error(`✗ 找不到昵称「${cfg.nickname}」`);
		if (list.length) console.error(`  相近的：${list.slice(0, 8).map((a) => a.name).join(" / ")}`);
		process.exit(1);
	}
	if (exact.hidden) console.warn("  注意：该账号隐藏了战绩，数据可能为空。");
	console.log(`  spa_id：${exact.spa_id}`);

	// 2. 账号 + 单船
	const [accRaw, shipsRaw, gloss] = await Promise.all([
		get(`/api/accounts/${exact.spa_id}/`),
		get(`/api/accounts/${exact.spa_id}/ships/pvp/`),
		loadCnGlossary(base),
	]);
	const info = accRaw[String(exact.spa_id)];
	const basic = info.statistics?.basic ?? {};
	const shipStats = shipsRaw[String(exact.spa_id)]?.statistics ?? {};

	const glossMap = new Map((gloss.vehicles ?? []).map((v) => [String(v.id), v]));

	const ships = Object.entries(shipStats)
		.map(([shipId, modes]) => {
			const meta = glossMap.get(shipId);
			if (!meta || num(modes.pvp?.battles_count) <= 0) return null;
			return {
				shipId: Number(shipId),
				name: meta.title,
				nameEn: meta.titleShort || meta.title,
				tier: num(meta.level),
				type: TYPE_NAME_MAP[meta.type?.name] ?? "Unknown",
				typeLabel: meta.type?.title ?? "未知",
				nation: meta.nation?.name ?? "unknown",
				nationLabel: meta.nation?.title ?? "未知",
				premium: Boolean(meta.isPremium || meta.isSpecial),
				image: meta.icons?.small ? `https:${meta.icons.small}` : null,
				lastBattleAt: 0,
				...normalize(modes.pvp ?? {}),
			};
		})
		.filter(Boolean)
		.sort((a, b) => b.battles - a.battles);

	const profile = buildProfile({
		nickname: info.name,
		accountId: exact.spa_id,
		realm: cfg.realm,
		createdAt: basic.created_at ?? info.created_at,
		lastBattleAt: basic.last_battle_time,
		levelingTier: basic.leveling_tier ?? null,
		hidden: exact.hidden,
		pvp: normalize(info.statistics?.pvp ?? {}),
		ranked: info.statistics?.rank_solo ? normalize(info.statistics.rank_solo) : null,
		ships,
		gameVersion: gloss.version,
	});

	return { profile, ships, source: base };
}

/* ------------------------------------------------------------------ */
/* 国际服（官方 API，需要 application_id）                              */
/* ------------------------------------------------------------------ */

const SHIP_TYPE_LABEL = {
	Destroyer: "驱逐舰",
	Cruiser: "巡洋舰",
	Battleship: "战列舰",
	AirCarrier: "航空母舰",
	Submarine: "潜艇",
};
const NATION_LABEL = {
	usa: "美国", japan: "日本", ussr: "苏联", germany: "德国", uk: "英国",
	france: "法国", italy: "意大利", pan_asia: "泛亚", europe: "欧洲",
	netherlands: "荷兰", pan_america: "泛美", spain: "西班牙", commonwealth: "联邦",
};

async function fetchOfficial(cfg) {
	const host = OFFICIAL_API[cfg.realm];
	if (!host) {
		console.error(`未知的服务器：${cfg.realm}`);
		process.exit(1);
	}
	if (!cfg.appId) {
		console.error(
			`服务器 ${cfg.realm} 需要 application_id（国服以外的服都用官方 API）。\n` +
				`到 ${OFFICIAL_ROOM[cfg.realm]} 免费申请，然后：\n` +
				`  WOWS_APP_ID=你的id node scripts/fetch-wows.mjs`,
		);
		process.exit(1);
	}
	const base = `https://${host}`;
	const api = officialApi(base, cfg.appId);

	console.log(`→ ${REALM_LABEL[cfg.realm]}（官方 API），昵称 ${cfg.nickname}`);

	// 1. 昵称 → account_id
	const candidates = await api("account/list/", { search: cfg.nickname, limit: 100 });
	const list = Array.isArray(candidates) ? candidates : [];
	const exact = list.find((a) => a.nickname.toLowerCase() === cfg.nickname.toLowerCase());
	if (!exact) {
		console.error(`✗ 找不到昵称「${cfg.nickname}」`);
		if (list.length) console.error(`  相近的：${list.slice(0, 8).map((a) => a.nickname).join(" / ")}`);
		process.exit(1);
	}
	console.log(`  account_id：${exact.account_id}`);

	// 2. 账号 + 单船
	const [infoData, statsData] = await Promise.all([
		api("account/info/", { account_id: exact.account_id, extra: "statistics.rank_solo" }),
		api("ships/stats/", { account_id: exact.account_id }),
	]);
	const info = infoData?.[exact.account_id];
	if (!info) {
		console.error("拿不到账号信息（可能隐藏了战绩）。");
		process.exit(1);
	}

	// 3. 船的元数据（中英双名）
	const shipIds = (statsData?.[exact.account_id] ?? []).map((r) => r.ship_id);
	const meta = await fetchOfficialShipMeta(base, cfg.appId, shipIds, ["zh-cn", "en"]);

	const ships = (statsData?.[exact.account_id] ?? [])
		.filter((row) => num(row.pvp?.battles) > 0)
		.map((row) => {
			const m = meta.zh.get(row.ship_id) ?? {};
			return {
				shipId: row.ship_id,
				name: m.name ?? meta.en.get(row.ship_id)?.name ?? `#${row.ship_id}`,
				nameEn: meta.en.get(row.ship_id)?.name ?? m.name ?? `#${row.ship_id}`,
				tier: num(m.tier),
				type: m.type ?? "Unknown",
				typeLabel: SHIP_TYPE_LABEL[m.type] ?? m.type ?? "未知",
				nation: m.nation ?? "unknown",
				nationLabel: NATION_LABEL[m.nation] ?? m.nation ?? "未知",
				premium: Boolean(m.premium),
				image: m.image ?? null,
				lastBattleAt: num(row.last_battle_time),
				...normalize(row.pvp ?? {}),
			};
		})
		.sort((a, b) => b.battles - a.battles);

	const profile = buildProfile({
		nickname: info.nickname,
		accountId: exact.account_id,
		realm: cfg.realm,
		createdAt: info.created_at,
		lastBattleAt: info.last_battle_time,
		levelingTier: info.leveling_tier,
		hidden: info.hidden_profile,
		pvp: normalize(info.statistics?.pvp ?? {}),
		ranked: info.statistics?.rank_solo ? normalize(info.statistics.rank_solo) : null,
		ships,
		gameVersion: null,
	});

	return { profile, ships, source: base };
}

function officialApi(base, appId) {
	return (endpoint, params) => {
		const url = new URL(`/wows/${endpoint}`, base);
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
		url.searchParams.set("application_id", appId);
		return fetchJson(url, { headers: {} });
	};
}

async function fetchOfficialShipMeta(base, appId, shipIds, language) {
	const ids = [...new Set(shipIds)];
	const out = new Map();
	for (const lang of language) {
		const map = out.get(lang) ?? new Map();
		const api = officialApi(base, appId);
		for (let i = 0; i < ids.length; i += 90) {
			const chunk = ids.slice(i, i + 90);
			const data = await api("encyclopedia/ships/", {
				ship_id: chunk.join(","),
				language: lang,
				fields: "ship_id,name,tier,type,nation,is_premium,images.small",
			});
			for (const [id, ship] of Object.entries(data ?? {})) {
				map.set(Number(id), {
					name: ship.name,
					tier: num(ship.tier),
					type: ship.type,
					nation: ship.nation,
					premium: Boolean(ship.is_premium),
					image: ship.images?.small ?? null,
				});
			}
			await sleep(120);
		}
		out.set(lang, map);
	}
	return { zh: out.get("zh-cn"), en: out.get("en") };
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

async function main() {
	const cfg = await loadConfig();
	if (!cfg.nickname) {
		console.error("✗ 还没配置昵称。改 wows.config.json 的 nickname，或 WOWS_NICKNAME=xxx");
		process.exit(1);
	}

	const isCn = cfg.realm === "cn";
	const { profile, ships, source } = isCn ? await fetchCn(cfg) : await fetchOfficial(cfg);

	const meta = {
		generatedAt: new Date().toISOString(),
		source,
		realm: cfg.realm,
		accountId: profile.accountId,
		nickname: profile.nickname,
		gameVersion: profile.gameVersion ?? null,
	};

	await mkdir(DATA_DIR, { recursive: true });
	await writeFile(path.join(DATA_DIR, "profile.json"), `${JSON.stringify(profile, null, "\t")}\n`);
	await writeFile(path.join(DATA_DIR, "ships.json"), `${JSON.stringify(ships, null, "\t")}\n`);
	await writeFile(path.join(DATA_DIR, "meta.json"), `${JSON.stringify(meta, null, "\t")}\n`);

	const p = profile.pvp;
	console.log(
		`✓ 完成：${ships.length} 艘船 / ${p.battles} 场随机战 / 胜率 ${(p.winrate * 100).toFixed(1)}% / 场均伤害 ${p.avgDamage}`,
	);
}

main().catch((e) => {
	console.error("✗ 抓取失败：", e.message);
	process.exit(1);
});
