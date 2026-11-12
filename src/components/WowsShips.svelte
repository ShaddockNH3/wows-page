<script lang="ts">
	interface Ship {
		shipId: number;
		name: string;
		tier: number;
		type: string;
		typeLabel: string;
		nationLabel: string;
		premium: boolean;
		image: string | null;
		battles: number;
		winrate: number;
		avgDamage: number;
		pr: number | null;
		prLabel: string;
	}

	interface Props {
		ships: Ship[];
		perPage?: number;
	}

	let { ships, perPage = 12 }: Props = $props();

	const SORTS = [
		{ key: "battles", label: "场次" },
		{ key: "winrate", label: "胜率" },
		{ key: "avgDamage", label: "场均伤害" },
		{ key: "pr", label: "PR" },
	] as const;

	type SortKey = (typeof SORTS)[number]["key"];

	/** 按某个字段归组，多的排前面 */
	const groupBy = (pick: (s: Ship) => string) => {
		const map = new Map<string, number>();
		for (const s of ships) {
			const k = pick(s);
			map.set(k, (map.get(k) ?? 0) + 1);
		}
		return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	};

	const types = $derived(groupBy((s) => s.typeLabel));
	const nations = $derived(groupBy((s) => s.nationLabel));
	const tiers = $derived([...new Set(ships.map((s) => s.tier))].sort((a, b) => a - b));

	let type = $state("全部");
	let nation = $state("全部");
	let tier = $state<number | "全部">("全部");
	let sort = $state<SortKey>("battles");
	let page = $state(1);

	const list = $derived(
		ships
			.filter(
				(s) =>
					(type === "全部" || s.typeLabel === type) &&
					(nation === "全部" || s.nationLabel === nation) &&
					(tier === "全部" || s.tier === tier),
			)
			.slice()
			.sort((a, b) => Number(b[sort] ?? 0) - Number(a[sort] ?? 0)),
	);

	const totalPages = $derived(Math.max(1, Math.ceil(list.length / perPage)));
	const view = $derived(list.slice((page - 1) * perPage, page * perPage));

	function pickType(v: string) {
		type = v;
		page = 1;
	}
	function pickNation(v: string) {
		nation = v;
		page = 1;
	}
	function pickTier(v: number | "全部") {
		tier = v;
		page = 1;
	}
	function pickSort(v: SortKey) {
		sort = v;
		page = 1;
	}

	const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
	const num = (v: number) => v.toLocaleString("en-US");
</script>

<div class="wsp-bar">
	<div class="wsp-row">
		<span class="wsp-row-t">舰种</span>
		<button class="wsp-chip" data-on={type === "全部"} onclick={() => pickType("全部")}>
			全部<span class="wsp-n">{ships.length}</span>
		</button>
		{#each types as [label, n] (label)}
			<button class="wsp-chip" data-on={type === label} onclick={() => pickType(label)}>
				{label}<span class="wsp-n">{n}</span>
			</button>
		{/each}
	</div>

	<div class="wsp-row">
		<span class="wsp-row-t">国家</span>
		<button class="wsp-chip" data-on={nation === "全部"} onclick={() => pickNation("全部")}>全部</button>
		{#each nations as [label, n] (label)}
			<button class="wsp-chip" data-on={nation === label} onclick={() => pickNation(label)}>
				{label}<span class="wsp-n">{n}</span>
			</button>
		{/each}
	</div>

	<div class="wsp-row">
		<span class="wsp-row-t">等级</span>
		<button class="wsp-chip" data-on={tier === "全部"} onclick={() => pickTier("全部")}>全部</button>
		{#each tiers as t (t)}
			<button class="wsp-chip" data-on={tier === t} onclick={() => pickTier(t)}>T{t}</button>
		{/each}
	</div>
	<div class="wsp-row">
		<span class="wsp-row-t">排序</span>
		{#each SORTS as s (s.key)}
			<button class="wsp-chip" data-on={sort === s.key} onclick={() => pickSort(s.key)}>{s.label}</button>
		{/each}
		<span class="wsp-count">共 {list.length} 艘</span>
	</div>
</div>

{#if view.length}
	<div class="wsp-grid">
		{#each view as s (s.shipId)}
			<div class="wsp-card">
				<div class="wsp-media">
					{#if s.image}
						<img src={s.image} alt={s.name} loading="lazy" decoding="async" referrerpolicy="no-referrer" />
					{:else}
						<span class="wsp-noimg">{s.name}</span>
					{/if}
					<span class="wsp-tier">T{s.tier}</span>
					<span class="wsp-type">{s.typeLabel}</span>
				</div>
				<div class="wsp-body">
					<div class="wsp-title">
						<span class="wsp-name">{s.name}</span>
						{#if s.pr !== null}
							<span class="wsp-pr" title={`PR ${s.pr} · ${s.prLabel}`}>{s.pr}</span>
						{/if}
					</div>
					<div class="wsp-sub">{s.nationLabel}{s.premium ? " · 金币" : ""}</div>
					<div class="wsp-stats">
						<span><b>{num(s.battles)}</b>场次</span>
						<span><b>{pct(s.winrate)}</b>胜率</span>
						<span><b>{num(s.avgDamage)}</b>场均</span>
					</div>
				</div>
			</div>
		{/each}
	</div>

	{#if totalPages > 1}
		<div class="wsp-pager">
			<button disabled={page === 1} onclick={() => (page -= 1)}>上一页</button>
			<span>{page} / {totalPages}</span>
			<button disabled={page === totalPages} onclick={() => (page += 1)}>下一页</button>
		</div>
	{/if}
{:else}
	<p class="wsp-empty">没有符合条件的舰船。</p>
{/if}

<style>
	.wsp-bar {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 16px 0;
	}
	.wsp-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		row-gap: 7px;
	}
	.wsp-row-t {
		font-size: 0.72rem;
		color: var(--content-meta);
		min-width: 46px;
		opacity: 0.75;
	}
	.wsp-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 10px;
		border-radius: 999px;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--content-meta);
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}
	.wsp-chip:hover {
		background: var(--btn-regular-bg);
	}
	.wsp-chip[data-on="true"] {
		background: var(--primary);
		border-color: transparent;
		color: #fff;
	}
	.wsp-n {
		font-size: 0.68rem;
		opacity: 0.55;
	}
	.wsp-chip[data-on="true"] .wsp-n {
		opacity: 0.8;
	}
	.wsp-count {
		margin-left: auto;
		font-size: 0.72rem;
		color: var(--content-meta);
	}

	.wsp-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
		gap: 12px;
	}
	.wsp-card {
		overflow: hidden;
		border-radius: var(--radius-large);
		background: var(--card-bg);
		border: 1px solid var(--line-divider);
		transition:
			transform 0.18s,
			box-shadow 0.18s;
	}
	.wsp-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.08);
	}
	.wsp-media {
		position: relative;
		aspect-ratio: 16 / 9;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		padding: 8px 8px 4px;
	}
	.wsp-media img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.wsp-noimg {
		font-size: 0.75rem;
		color: var(--content-meta);
	}
	.wsp-tier,
	.wsp-type {
		position: absolute;
		top: 6px;
		font-size: 0.64rem;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 6px;
		background: color-mix(in oklch, var(--card-bg) 86%, transparent);
		border: 1px solid var(--line-divider);
		color: var(--content-meta);
		backdrop-filter: blur(4px);
	}
	.wsp-tier {
		left: 6px;
		color: var(--primary);
	}
	.wsp-type {
		right: 6px;
	}
	.wsp-body {
		padding: 8px 11px 11px;
	}
	.wsp-title {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.wsp-name {
		font-size: 0.86rem;
		font-weight: 650;
		color: var(--deep-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.wsp-pr {
		margin-left: auto;
		flex-shrink: 0;
		font-size: 0.66rem;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 6px;
		color: var(--primary);
		background: color-mix(in oklch, var(--primary) 12%, transparent);
		font-variant-numeric: tabular-nums;
	}
	.wsp-sub {
		margin-top: 1px;
		font-size: 0.68rem;
		color: var(--content-meta);
	}
	.wsp-stats {
		display: flex;
		justify-content: space-between;
		gap: 4px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--line-divider);
		font-size: 0.64rem;
		color: var(--content-meta);
	}
	.wsp-stats span {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.wsp-stats b {
		font-size: 0.78rem;
		font-weight: 650;
		color: var(--deep-text);
		font-variant-numeric: tabular-nums;
	}
	.wsp-pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-top: 18px;
		font-size: 0.78rem;
		color: var(--content-meta);
	}
	.wsp-pager button {
		padding: 5px 12px;
		border-radius: 999px;
		border: 1px solid var(--line-divider);
		background: var(--card-bg);
		color: var(--content-meta);
		font: inherit;
		cursor: pointer;
	}
	.wsp-pager button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.wsp-empty {
		padding: 40px 0;
		text-align: center;
		font-size: 0.85rem;
		color: var(--content-meta);
	}
</style>
