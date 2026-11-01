#!/usr/bin/env node
/**
 * 抓取《战舰世界》玩家档案，生成静态数据文件。
 *
 * 用法：
 *   WOWS_APP_ID=xxx WOWS_NICKNAME=你的昵称 WOWS_REALM=asia node scripts/fetch-wows.mjs
 *
 * 环境变量：
 *   WOWS_APP_ID    Wargaming 应用 ID（必填，除非改下面的 FALLBACK_APP_ID）
 *   WOWS_NICKNAME  游戏内昵称
 *   WOWS_REALM     asia | eu | na | ru  （默认 asia）
 *
 * 产物：
 *   src/data/profile.json  账号总览
 *   src/data/ships.json    单船战绩（已补全名称 / 图标 / 舰种 / 等级）
 *   src/data/meta.json     数据版本与生成时间
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const CACHE_DIR = path.join(ROOT, ".cache");

/** 开发用的公共 application_id，仅亚服可用，正式部署请换成自己的 */
const FALLBACK_APP_ID = "ab69ce1bc38671074dc4bdc67b3645c7";

async function loadConfig() {
	let file = {};
	try {
		file = JSON.parse(await readFile(path.join(ROOT, "wows.config.json"), "utf8"));
	} catch {
		// 没有配置文件就用默认值
	}
	const realm = (process.env.WOWS_REALM || file.realm || "asia").toLowerCase();
	const appId =
		process.env.WOWS_APP_ID || file.appId || (realm === "asia" ? FALLBACK_APP_ID : "");
	return {
		realm,
		nickname: process.env.WOWS_NICKNAME || file.nickname || "Shaddock_NH3",
		appId,
	};
}

const CONFIG = await loadConfig();

const HOSTS = {
	asia: "https://api.worldofwarships.asia",
	eu: "https://api.worldofwarships.eu",
	na: "https://api.worldofwarships.com",
	ru: "https://api.worldofwarships.ru",
	/** 国服（360）走独立接口，application_id 需在 developers.wggames.cn 申请 */
	cn: "https://api.wowsgame.cn",
};

const host = HOSTS[CONFIG.realm];
if (!host) {
	console.error(`未知的服务器：${CONFIG.realm}（可选：asia / eu / na / ru / cn）`);
	process.exit(1);
}
if (!CONFIG.appId) {
	const room = CONFIG.realm === "cn" ? "https://developers.wggames.cn/" : "https://developers.wargaming.net/applications/";
	console.error(
		`服务器 ${CONFIG.realm} 需要自己的 application_id。\n` +
			`到 ${room} 申请后，运行：\n` +
			`  WOWS_APP_ID=你的id node scripts/fetch-wows.mjs\n` +
			`或写进 wows.config.json 的 appId 字段。`,
	);
	process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(endpoint, params, attempt = 0) {
	const url = new URL(endpoint, `${host}/wows/`);
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
	}
	url.searchParams.set("application_id", CONFIG.appId);

	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "wows-page/1.0 (+https://github.com/ShaddockNH3/wows-page)" },
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const json = await res.json();
		if (json.status === "error") {
			const err = json.error ?? {};
			// 限流时退避重试
			if (err.code === 4071 || /REQUEST_LIMIT/i.test(err.message ?? "")) {
				throw Object.assign(new Error(`rate limited: ${err.message}`), { retry: true });
			}
			throw new Error(`${err.code ?? "?"} ${err.message ?? "unknown error"}`);
		}
		return json.data;
	} catch (e) {
		if (attempt < 3) {
			await sleep(1500 * (attempt + 1));
			return api(endpoint, params, attempt + 1);
		}
		throw e;
	}
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const ratio = (a, b, digits = 4) => (b > 0 ? Number((a / b).toFixed(digits)) : 0);

/** 把 WG 的原始统计块压成好用的形状 */
function normalizeStats(block = {}) {
	const battles = num(block.battles);
	const wins = num(block.wins);
	const survived = num(block.survived_battles);
	const frags = num(block.frags);
	const damage = num(block.damage_dealt);
	const xp = num(block.xp);
	const shots = num(block.main_battery?.shots);
	const hits = num(block.main_battery?.hits);
	const torpShots = num(block.torpedoes?.shots);
	const torpHits = num(block.torpedoes?.hits);

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
		maxFrags: num(block.max_frags_battle),
		maxXp: num(block.max_xp),
		maxPlanesKilled: num(block.max_planes_killed),
	};
}

const SHIP_TYPE_LABEL = {
	Destroyer: "驱逐舰",
	Cruiser: "巡洋舰",
	Battleship: "战列舰",
	AirCarrier: "航空母舰",
	Submarine: "潜艇",
};

const NATION_LABEL = {
	usa: "美国",
	japan: "日本",
	ussr: "苏联",
	germany: "德国",
	uk: "英国",
	france: "法国",
	italy: "意大利",
	pan_asia: "泛亚",
	europe: "欧洲",
	netherlands: "荷兰",
	pan_america: "泛美",
	spain: "西班牙",
	commonwealth: "联邦",
};

async function fetchShipMeta(shipIds, language) {
	const ids = [...new Set(shipIds)];
	const out = new Map();
	const CHUNK = 90;
	for (let i = 0; i < ids.length; i += CHUNK) {
		const chunk = ids.slice(i, i + CHUNK);
		const data = await api("encyclopedia/ships/", {
			ship_id: chunk.join(","),
			language,
			fields: "ship_id,name,tier,type,nation,is_premium,images.small",
		});
		for (const [id, ship] of Object.entries(data ?? {})) {
			out.set(Number(id), {
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
	return out;
}

async function main() {
	console.log(`→ 服务器 ${CONFIG.realm}，账号 ${CONFIG.nickname}`);

	// 1. 昵称 → account_id
	const candidates = await api("account/list/", { search: CONFIG.nickname, limit: 100 });
	const list = Array.isArray(candidates) ? candidates : [];
	const exact = list.find((a) => a.nickname.toLowerCase() === CONFIG.nickname.toLowerCase());
	if (!exact) {
		console.error(`✗ 找不到昵称「${CONFIG.nickname}」（服务器：${CONFIG.realm}）`);
		if (list.length) {
			console.error(`  相近的账号：${list.slice(0, 8).map((a) => a.nickname).join(" / ")}`);
			console.error("  把 wows.config.json 里的 nickname 改成完全一致的写法再试。");
		} else {
			console.error("  换个服务器试试，或者确认昵称没打错。");
		}
		process.exit(1);
	}
	const accountId = exact.account_id;
	console.log(`  账号 ID：${accountId}（${exact.nickname}）`);

	// 2. 账号总览
	const infoData = await api("account/info/", {
		account_id: accountId,
		extra: "statistics.rank_solo",
	});
	const info = infoData?.[accountId];
	if (!info) {
		console.error("拿不到账号信息（可能是隐藏了战绩）。");
		process.exit(1);
	}

	// 3. 单船战绩
	const statsData = await api("ships/stats/", { account_id: accountId });
	const shipRows = statsData?.[accountId] ?? [];

	// 4. 补全舰船元数据（中英双名）
	const shipIds = shipRows.map((r) => r.ship_id);
	const [zh, en] = await Promise.all([
		fetchShipMeta(shipIds, "zh-cn"),
		fetchShipMeta(shipIds, "en"),
	]);

	const ships = shipRows
		.filter((row) => num(row.pvp?.battles) > 0)
		.map((row) => {
			const meta = zh.get(row.ship_id) ?? {};
			const pvp = normalizeStats(row.pvp ?? {});
			return {
				shipId: row.ship_id,
				name: meta.name ?? en.get(row.ship_id)?.name ?? `#${row.ship_id}`,
				nameEn: en.get(row.ship_id)?.name ?? meta.name ?? `#${row.ship_id}`,
				tier: meta.tier ?? 0,
				type: meta.type ?? "Unknown",
				typeLabel: SHIP_TYPE_LABEL[meta.type] ?? meta.type ?? "未知",
				nation: meta.nation ?? "unknown",
				nationLabel: NATION_LABEL[meta.nation] ?? meta.nation ?? "未知",
				premium: Boolean(meta.premium),
				image: meta.image ?? null,
				lastBattleAt: num(row.last_battle_time),
				distance: num(row.distance),
				...pvp,
			};
		})
		.sort((a, b) => b.battles - a.battles);

	// 5. 汇总
	const pvp = normalizeStats(info.statistics?.pvp ?? {});
	const ranked = info.statistics?.rank_solo ? normalizeStats(info.statistics.rank_solo) : null;

	const byType = {};
	const byNation = {};
	const byTier = {};
	for (const s of ships) {
		const t = (byType[s.type] ??= { key: s.type, label: s.typeLabel, battles: 0, wins: 0, damage: 0, ships: 0 });
		t.battles += s.battles;
		t.wins += s.wins;
		t.damage += s.damage;
		t.ships += 1;

		const n = (byNation[s.nation] ??= { key: s.nation, label: s.nationLabel, battles: 0, wins: 0, damage: 0, ships: 0 });
		n.battles += s.battles;
		n.wins += s.wins;
		n.damage += s.damage;
		n.ships += 1;

		const tier = (byTier[s.tier] ??= { tier: s.tier, battles: 0, wins: 0, damage: 0, ships: 0 });
		tier.battles += s.battles;
		tier.wins += s.wins;
		tier.damage += s.damage;
		tier.ships += 1;
	}

	const finishDistribution = (obj) =>
		Object.values(obj)
			.map((d) => ({
				...d,
				winrate: ratio(d.wins, d.battles),
				avgDamage: Math.round(ratio(d.damage, d.battles, 0)),
			}))
			.sort((a, b) => b.battles - a.battles);

	const profile = {
		nickname: info.nickname,
		accountId,
		realm: CONFIG.realm,
		realmLabel: { asia: "亚服", eu: "欧服", na: "美服", ru: "俄服", cn: "国服" }[CONFIG.realm] ?? CONFIG.realm,
		createdAt: num(info.created_at),
		lastBattleAt: num(info.last_battle_time),
		levelingTier: num(info.leveling_tier),
		levelingPoints: num(info.leveling_points),
		karma: num(info.karma),
		hiddenProfile: Boolean(info.hidden_profile),
		pvp,
		ranked,
		shipCount: ships.length,
		topShip: ships[0]
			? { name: ships[0].name, battles: ships[0].battles, winrate: ships[0].winrate }
			: null,
		bestWinrateShip: [...ships]
			.filter((s) => s.battles >= 8)
			.sort((a, b) => b.winrate - a.winrate)[0] ?? null,
		bestDamageShip: [...ships].sort((a, b) => b.avgDamage - a.avgDamage)[0] ?? null,
		byType: finishDistribution(byType),
		byNation: finishDistribution(byNation),
		byTier: finishDistribution(byTier).sort((a, b) => a.tier - b.tier),
	};

	const meta = {
		generatedAt: new Date().toISOString(),
		source: `${host}/wows/`,
		realm: CONFIG.realm,
		accountId,
		nickname: info.nickname,
	};

	await mkdir(DATA_DIR, { recursive: true });
	await mkdir(CACHE_DIR, { recursive: true });
	await writeFile(path.join(DATA_DIR, "profile.json"), `${JSON.stringify(profile, null, "\t")}\n`);
	await writeFile(path.join(DATA_DIR, "ships.json"), `${JSON.stringify(ships, null, "\t")}\n`);
	await writeFile(path.join(DATA_DIR, "meta.json"), `${JSON.stringify(meta, null, "\t")}\n`);

	console.log(
		`✓ 完成：${ships.length} 艘船 / ${pvp.battles} 场随机战 / 胜率 ${(pvp.winrate * 100).toFixed(1)}%`,
	);
}

main().catch((e) => {
	console.error("✗ 抓取失败：", e.message);
	process.exit(1);
});
