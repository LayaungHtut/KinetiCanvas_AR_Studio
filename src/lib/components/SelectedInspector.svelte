<script lang="ts">
	import { getStudio } from '../kineticanvas/context';

	const studio = getStudio();
</script>

{#if studio.selected}
	<div
		class="glass-panel absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-700/80 px-4 py-2.5 shadow-2xl"
	>
		<span class="font-mono text-xs font-semibold tracking-wider text-cyan-400 uppercase">
			{studio.selected.type}
		</span>
		<div class="h-4 w-px bg-slate-700"></div>
		<button
			type="button"
			onclick={() => studio.pulseSelected()}
			class="rounded-lg border border-cyan-500/30 bg-cyan-500/20 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/30"
		>
			Test Pulse / Pluck
		</button>
		<button
			type="button"
			onclick={() => studio.deleteSelected()}
			class="rounded-lg border border-rose-500/30 bg-rose-500/20 px-2.5 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-500/30"
		>
			Delete Shape
		</button>
	</div>
{/if}
