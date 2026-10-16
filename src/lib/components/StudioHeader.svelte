<script lang="ts">
	import { getStudio } from '../kineticanvas/context';
	import Icon from './Icon.svelte';

	const studio = getStudio();

	const sourceButton =
		'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition';
	const idleSource = 'border-slate-700 bg-slate-800/90 text-slate-200 hover:bg-slate-700';
	const activeSource = 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300';

	function onVideoFile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		if (file) studio.loadVideoFile(file);
		// Allow picking the same file again
		e.currentTarget.value = '';
	}
</script>

<header
	class="glass-panel z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-3 py-2"
>
	<!-- Brand & source status -->
	<div class="flex items-center gap-3">
		<div
			class="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-lg shadow-cyan-500/20"
		>
			<Icon name="logo" class="h-5 w-5 text-slate-950" strokeWidth={2.3} />
		</div>
		<div>
			<div class="flex items-center gap-2">
				<h1 class="text-sm font-bold tracking-tight text-white sm:text-base">
					KinetiCanvas <span class="font-mono text-xs font-normal text-cyan-400">AR.STUDIO</span>
				</h1>
				<span
					class="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] tracking-wider text-cyan-300 uppercase"
				>
					{studio.sourceBadge}
				</span>
			</div>
			<p class="hidden text-[11px] text-slate-400 sm:block">
				Draw Interactive Harp Strings, Contours & Radar Rings over Video or Camera
			</p>
		</div>
	</div>

	<!-- Video / camera input switcher -->
	<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
		<button
			type="button"
			disabled={studio.handTrackingLoading}
			aria-pressed={studio.handTrackingEnabled}
			onclick={() => studio.toggleHandTracking()}
			class={[
				'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-lg transition disabled:cursor-wait disabled:opacity-70',
				studio.handTrackingEnabled
					? 'border-emerald-400 bg-emerald-500/30 text-emerald-200 shadow-emerald-500/20'
					: 'border-cyan-400/60 bg-linear-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 shadow-cyan-500/10 hover:from-cyan-500/40 hover:to-blue-500/40'
			]}
		>
			<Icon name="hand" class="h-4 w-4 text-cyan-300" />
			<span>
				{#if studio.handTrackingLoading}
					Hand Gestures: Loading…
				{:else}
					Hand Gestures: {studio.handTrackingEnabled ? 'ON' : 'OFF'}
				{/if}
			</span>
		</button>

		<button
			type="button"
			onclick={() => studio.useCamera()}
			class={[sourceButton, studio.videoMode === 'camera' ? activeSource : idleSource]}
		>
			<Icon name="camera" class="h-3.5 w-3.5 text-rose-400" />
			<span>Live Camera</span>
		</button>

		<label
			class={[
				sourceButton,
				'cursor-pointer focus-within:ring-2 focus-within:ring-cyan-400/60',
				studio.videoMode === 'upload' ? activeSource : idleSource
			]}
		>
			<Icon name="upload" class="h-3.5 w-3.5 text-amber-400" />
			<span>Load Video</span>
			<input type="file" accept="video/*" class="sr-only" onchange={onVideoFile} />
		</label>

		<button
			type="button"
			onclick={() => studio.useDemoStream()}
			class={[sourceButton, studio.videoMode === 'synth' ? activeSource : idleSource]}
		>
			<Icon name="bolt" class="h-3.5 w-3.5 text-cyan-400" />
			<span class="hidden md:inline">Demo Motion Stream</span>
			<span class="md:hidden">Demo</span>
		</button>

		<button
			type="button"
			title="Mirror Video Horizontally"
			aria-label="Mirror video horizontally"
			aria-pressed={studio.mirrorVideo}
			onclick={() => studio.toggleMirror()}
			class="rounded-lg border border-slate-700 bg-slate-800/90 p-1.5 text-slate-300 transition hover:bg-slate-700"
		>
			<Icon name="mirror" />
		</button>
	</div>

	<!-- Audio & export -->
	<div class="flex items-center gap-2">
		<button
			type="button"
			aria-pressed={studio.audioEnabled}
			onclick={() => studio.toggleAudio()}
			class={[
				'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
				studio.audioEnabled
					? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
					: 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'
			]}
		>
			<Icon name={studio.audioEnabled ? 'speaker' : 'muted'} class="h-3.5 w-3.5" />
			<span>{studio.audioEnabled ? 'Synth ON' : 'Muted'}</span>
		</button>

		<button
			type="button"
			title="Capture Snapshot PNG"
			aria-label="Capture snapshot PNG"
			onclick={() => studio.takeSnapshot()}
			class="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
		>
			<Icon name="snapshot" class="h-3.5 w-3.5 text-cyan-400" />
			<span class="hidden sm:inline">Snap</span>
		</button>

		<button
			type="button"
			aria-pressed={studio.isRecording}
			onclick={() => studio.toggleRecording()}
			class="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
		>
			<span
				class={[
					'h-2.5 w-2.5 rounded-full bg-rose-500',
					studio.isRecording && 'animate-pulse-recording'
				]}
			></span>
			<span>{studio.isRecording ? 'Stop' : 'Rec'}</span>
		</button>
	</div>
</header>
