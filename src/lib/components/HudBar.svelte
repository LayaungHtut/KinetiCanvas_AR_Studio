<script lang="ts">
	import { getStudio } from '../kineticanvas/context';

	const studio = getStudio();

	const handBadge = $derived.by(() => {
		if (!studio.hands.isPresent) {
			return { text: 'SHOW HAND TO CAMERA', class: 'bg-slate-800 text-slate-400' };
		}
		if (studio.hands.isSqueezing) {
			return {
				text: 'SQUEEZING // DRAWING WIRE',
				class: 'border border-amber-400/50 bg-amber-500/30 text-amber-300'
			};
		}
		return { text: 'OPEN HAND // PLUCK & HOVER', class: 'bg-cyan-500/20 text-cyan-300' };
	});
</script>

<div
	class="pointer-events-none absolute top-3 right-3 left-3 flex items-center justify-between gap-2"
>
	<div
		class="glass-panel flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-slate-200 shadow-lg"
	>
		<span class="h-2 w-2 shrink-0 animate-ping rounded-full bg-cyan-400"></span>
		<span>{studio.hudText}</span>
	</div>

	<div class="flex items-center gap-2">
		{#if studio.handTrackingEnabled}
			<div
				class="glass-panel flex items-center gap-2.5 rounded-full border border-cyan-500/40 px-3 py-1.5 font-mono text-[11px] shadow-lg"
			>
				<span class={['rounded px-1.5 py-0.5 font-semibold', handBadge.class]}>
					{handBadge.text}
				</span>
				<div class="h-2 w-20 overflow-hidden rounded-full border border-slate-700 bg-slate-800">
					<div
						class="h-full bg-linear-to-r from-cyan-400 to-amber-400 transition-all duration-75"
						style:width="{studio.hands.squeezePct}%"
					></div>
				</div>
			</div>
		{/if}

		<div
			class="glass-panel hidden items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] text-slate-300 md:flex"
		>
			<span>SHAPES: <strong class="text-cyan-400">{studio.shapeCount}</strong></span>
			<span class="text-slate-600">|</span>
			<span>MOTION: <strong class="text-emerald-400">{studio.averageMotion}%</strong></span>
			<span class="text-slate-600">|</span>
			<span>NOTE: <strong class="text-amber-400">{studio.lastNote}</strong></span>
		</div>
	</div>
</div>
