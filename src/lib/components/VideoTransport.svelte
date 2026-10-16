<script lang="ts">
	import { getStudio } from '../kineticanvas/context';

	const studio = getStudio();

	const progress = $derived(
		studio.playback.duration ? (studio.playback.currentTime / studio.playback.duration) * 100 : 0
	);
	const timeLabel = $derived.by(() => {
		const t = studio.playback.currentTime;
		return `${Math.floor(t / 60)}:${Math.floor(t % 60)
			.toString()
			.padStart(2, '0')}`;
	});
</script>

{#if studio.videoMode === 'upload'}
	<div
		class="glass-panel absolute bottom-3 left-1/2 z-20 flex w-11/12 max-w-lg -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2"
	>
		<button
			type="button"
			aria-label={studio.playback.paused ? 'Play video' : 'Pause video'}
			onclick={() => studio.togglePlayback()}
			class="text-slate-200 transition hover:text-cyan-400"
		>
			<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
				{#if studio.playback.paused}
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
						clip-rule="evenodd"
					/>
				{:else}
					<path
						fill-rule="evenodd"
						d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
						clip-rule="evenodd"
					/>
				{/if}
			</svg>
		</button>
		<input
			type="range"
			min="0"
			max="100"
			step="0.1"
			value={progress}
			aria-label="Seek video"
			oninput={(e) => studio.seek(e.currentTarget.valueAsNumber / 100)}
			class="h-1.5 flex-1 cursor-pointer rounded-lg bg-slate-800 accent-cyan-400"
		/>
		<span class="font-mono text-[11px] text-slate-300">{timeLabel}</span>
	</div>
{/if}
