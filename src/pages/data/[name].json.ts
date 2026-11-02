/**
 * 把抓取到的数据作为静态 JSON 发布出去。
 * 博客那边构建前会来取这三个文件，这样数据只需要维护一份。
 *
 * 产物：/data/profile.json、/data/ships.json、/data/meta.json
 */
import type { APIRoute } from "astro";
import meta from "../../data/meta.json";
import profile from "../../data/profile.json";
import ships from "../../data/ships.json";

const payloads: Record<string, unknown> = { profile, ships, meta };

export const getStaticPaths = () =>
	Object.keys(payloads).map((name) => ({ params: { name } }));

export const GET: APIRoute = ({ params }) => {
	const body = payloads[params.name ?? ""];
	if (!body) return new Response("Not found", { status: 404 });

	return new Response(JSON.stringify(body), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			// 给博客那边一点缓存余量，抓取本身一周才一次
			"Cache-Control": "public, max-age=3600",
		},
	});
};
