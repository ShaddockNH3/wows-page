/**
 * 站点配置 —— 想改什么基本都在这里。
 * 改完记得重新跑一次 `pnpm fetch` 更新数据。
 */

/**
 * 两套配色。
 * blog —— 跟博客主题色一致（Firefly 的 hue 是 360）
 * wows —— 海军蓝，更贴近游戏本身的气质
 * 色相 0-360：0 红、60 黄、150 青绿、210 蓝、265 紫、360 粉
 */
export const themes = {
	blog: { hue: 360, label: "博客" },
	wows: { hue: 210, label: "海军" },
} as const;

export type ThemeKey = keyof typeof themes;

export const siteConfig = {
	/** 页面标题（会显示在标签页与导航栏） */
	title: "舰长档案",

	/** 副标题 / 站点描述 */
	description: "一个静态的战舰世界个人战绩页面。",

	/** 博客主站地址，用于导航栏「返回博客」按钮；留空则不显示 */
	blogUrl: "https://blog.attilio.cc",

	/** 默认配色主题：blog | wows */
	defaultTheme: "blog" as ThemeKey,

	/** 默认配色模式：light | dark | system */
	defaultMode: "light" as "light" | "dark" | "system",

	/** 页脚署名 */
	author: "ShaddockNH3",

	publicAppId: import.meta.env.PUBLIC_WOWS_APP_ID || "",
};

export const realmLabel: Record<string, string> = {
	asia: "亚服",
	eu: "欧服",
	na: "美服",
	ru: "俄服",
	cn: "国服",
};

export const typeColor: Record<string, string> = {
	Destroyer: "var(--wows-t-destroyer)",
	Cruiser: "var(--wows-t-cruiser)",
	Battleship: "var(--wows-t-battleship)",
	AirCarrier: "var(--wows-t-carrier)",
	Submarine: "var(--wows-t-submarine)",
	Unknown: "var(--wows-t-unknown)",
};
