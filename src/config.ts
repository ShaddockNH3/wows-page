/**
 * 站点配置 —— 想改什么基本都在这里。
 * 改完记得重新跑一次 `pnpm fetch` 更新数据。
 */

export const siteConfig = {
	/** 页面标题（会显示在标签页与导航栏） */
	title: "舰长档案",

	/** 副标题 / 站点描述 */
	description: "一个静态的战舰世界个人战绩页面。",

	/** 博客主站地址，用于导航栏「返回博客」按钮；留空则不显示 */
	blogUrl: "https://blog.attilio.cc",

	/** 主题色相（0-360）。210 ≈ 海军蓝，360 ≈ 博客的粉色，265 ≈ 紫 */
	hue: 210,

	/** 默认配色模式：light | dark | system */
	defaultMode: "system" as "light" | "dark" | "system",

	/** 页脚署名 */
	author: "ShaddockNH3",

	/**
	 * 可选的「临时查别人」入口。
	 * 填了 application_id 才会在 /lookup 页面出现查询表单，
	 * 因为 WG 的接口需要 key，而 key 会暴露在前端 —— 请自行权衡。
	 */
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
	Destroyer: "var(--t-destroyer)",
	Cruiser: "var(--t-cruiser)",
	Battleship: "var(--t-battleship)",
	AirCarrier: "var(--t-carrier)",
	Submarine: "var(--t-submarine)",
	Unknown: "var(--t-unknown)",
};
