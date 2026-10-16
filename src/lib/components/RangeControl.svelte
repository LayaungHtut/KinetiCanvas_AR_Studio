<script lang="ts">
	let {
		label,
		value = $bindable(),
		min,
		max,
		suffix = ''
	}: { label: string; value: number; min: number; max: number; suffix?: string } = $props();
</script>

<label class="block space-y-1.5 rounded-xl border border-slate-800/80 bg-slate-900/70 p-2.5">
	<span class="flex justify-between text-xs">
		<span class="text-slate-300">{label}</span>
		<span class="font-mono text-cyan-400">{value}{suffix}</span>
	</span>
	<input
		type="range"
		{min}
		{max}
		bind:value
		class="h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-cyan-400"
	/>
</label>
