/** 展示层用的小工具 */

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

export const num = (v: number) => Math.round(v).toLocaleString("en-US");

export const compact = (v: number) => {
	if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
	if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
	return num(v);
};

export const date = (ts: number) => {
	if (!ts) return "—";
	return new Date(ts * 1000).toLocaleDateString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
};

export const relative = (ts: number) => {
	if (!ts) return "—";
	const days = Math.floor((Date.now() / 1000 - ts) / 86400);
	if (days < 0) return "刚刚";
	if (days === 0) return "今天";
	if (days === 1) return "昨天";
	if (days < 30) return `${days} 天前`;
	if (days < 365) return `${Math.floor(days / 30)} 个月前`;
	return `${(days / 365).toFixed(1)} 年前`;
};

/** 胜率分档，用于上色 */
export const wrGrade = (wr: number) => {
	if (wr >= 0.58) return "high";
	if (wr >= 0.52) return "above";
	if (wr >= 0.46) return "mid";
	return "low";
};

export const typeKey = (type: string) => {
	const map: Record<string, string> = {
		Destroyer: "destroyer",
		Cruiser: "cruiser",
		Battleship: "battleship",
		AirCarrier: "carrier",
		Submarine: "submarine",
	};
	return map[type] ?? "unknown";
};

export const typeVar = (type: string) => `var(--wows-t-${typeKey(type)})`;
