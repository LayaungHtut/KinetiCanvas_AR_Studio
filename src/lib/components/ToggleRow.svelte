<script lang="ts">
	let {
		title,
		description,
		checked = $bindable(),
		highlight = false
	}: { title: string; description: string; checked: boolean; highlight?: boolean } = $props();
</script>

<label
	class={[
		'flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-2',
		highlight
			? 'border-cyan-500/30 bg-cyan-950/30 hover:border-cyan-400/50'
			: 'border-slate-800/80 bg-slate-900/70 hover:border-slate-700'
	]}
>
	<span>
		<span class={['block text-xs font-medium', highlight ? 'text-cyan-100' : 'text-slate-200']}>
			{title}
		</span>
		<span class={['block text-[10px]', highlight ? 'text-cyan-300/70' : 'text-slate-400']}>
			{description}
		</span>
	</span>
	<input
		type="checkbox"
		bind:checked
		class="h-4 w-4 shrink-0 cursor-pointer rounded accent-cyan-400"
	/>
</label>
