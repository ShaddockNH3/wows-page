import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";

// 部署在子路径时（例如 https://blog.attilio.cc/wows/）设置 BASE_PATH=/wows
const base = process.env.BASE_PATH || "/";

export default defineConfig({
	site: process.env.SITE_URL || "https://wows.attilio.cc",
	base,
	trailingSlash: "ignore",
	integrations: [svelte()],
	build: {
		inlineStylesheets: "auto",
	},
	compressHTML: true,
	devToolbar: { enabled: false },
});
