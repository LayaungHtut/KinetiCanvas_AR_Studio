<script lang="ts">
	import { COLOR_SWATCHES, PRESETS, SCALES } from '../kineticanvas/constants';
	import { getStudio } from '../kineticanvas/context';
	import type { ScaleName, Tool } from '../kineticanvas/types';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons';
	import RangeControl from './RangeControl.svelte';
	import ToggleRow from './ToggleRow.svelte';

	const studio = getStudio();

	interface ToolOption {
		id: Tool;
		icon: IconName;
		label: string;
		hint: string;
		iconClass: string;
		idleClass?: string;
		titleClass?: string;
		hintClass?: string;
	}

	const tools: ToolOption[] = [
		{
			id: 'harp',
			icon: 'harp',
			label: 'Harp Strings',
			hint: 'Pluckable harmonic strings',
			iconClass: 'border-amber-500/30 bg-amber-500/15 text-amber-400'
		},
		{
			id: 'harparray',
			icon: 'harparray',
			label: 'Harp Fan / Array',
			hint: 'Drag box to span N strings',
			iconClass: 'border-orange-500/30 bg-orange-500/15 text-orange-400'
		},
		{
			id: 'contour',
			icon: 'contour',
			label: 'Contour Lines',
			hint: 'Draw multi-echo splines',
			iconClass: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-400'
		},
		{
			id: 'radar',
			icon: 'radar',
			label: 'Radar Rings',
			hint: 'Sonar sweep & target locks',
			iconClass: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
		},
		{
			id: 'select',
			icon: 'select',
			label: 'Edit & Move',
			hint: 'Grab nodes or reposition',
			iconClass: 'border-purple-500/30 bg-purple-500/15 text-purple-400'
		},
		{
			id: 'cut',
			icon: 'cut',
			label: 'Cut / Delete Wire',
			hint: 'Swipe hand or cursor to erase',
			iconClass: 'border-rose-500/40 bg-rose-500/20 text-rose-400',
			idleClass: 'border-rose-900/60 bg-rose-950/30 text-rose-300',
			titleClass: 'text-rose-300',
			hintClass: 'text-rose-400/80'
		}
	];

	const scaleOptions = Object.entries(SCALES) as [ScaleName, (typeof SCALES)[ScaleName]][];

	const handBadge = $derived(
		!studio.handTrackingEnabled
			? 'OFF'
			: !studio.hands.isPresent
				? 'SCANNING'
				: studio.hands.isSqueezing
					? 'SQUEEZING'
					: 'OPEN'
	);
</script>

<aside
	class="glass-panel z-20 flex w-16 shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-800/80 p-2 sm:w-60 sm:p-3"
>
	<div class="space-y-4">
		<!-- Shape tools -->
		<div>
			<div
				class="mb-2 hidden items-center justify-between px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:flex"
			>
				<span>Shape Tools</span>
				<span class="font-mono text-[9px] text-cyan-400">CLICK & DRAG</span>
			</div>
			<div class="grid grid-cols-1 gap-1.5">
				{#each tools as tool (tool.id)}
					{@const active = studio.activeTool === tool.id}
					<button
						type="button"
						title={tool.label}
						aria-pressed={active}
						onclick={() => studio.selectTool(tool.id)}
						class={[
							'flex items-center gap-3 rounded-xl border p-2 text-left transition-all duration-200 hover:text-white sm:px-3 sm:py-2.5',
							active
								? 'border-cyan-400/70 bg-linear-135 from-cyan-500/25 to-blue-500/25 text-white shadow-[0_0_18px_rgba(34,211,238,0.25)]'
								: (tool.idleClass ?? 'border-slate-800 bg-slate-900/60 text-slate-300')
						]}
					>
						<span
							class={[
								'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
								tool.iconClass
							]}
						>
							<Icon name={tool.icon} />
						</span>
						<span class="hidden overflow-hidden sm:block">
							<span class={['block text-xs leading-tight font-semibold', tool.titleClass]}>
								{tool.label}
							</span>
							<span class={['block truncate text-[10px]', tool.hintClass ?? 'text-slate-400']}>
								{tool.hint}
							</span>
						</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Color palette -->
		<div class="border-t border-slate-800/80 pt-2">
			<div
				class="mb-2 hidden px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:block"
			>
				Luminescence Color
			</div>
			<div class="flex flex-wrap justify-center gap-2 px-1 sm:justify-start">
				{#each COLOR_SWATCHES as swatch (swatch.value)}
					{@const active = studio.activeColor === swatch.value}
					<button
						type="button"
						title={swatch.name}
						aria-label={swatch.name}
						aria-pressed={active}
						onclick={() => studio.setColor(swatch.value)}
						style:background-color={swatch.value}
						class={[
							'h-5 w-5 rounded-full transition-[transform,box-shadow] duration-150',
							active && 'scale-120 shadow-[0_0_0_2px_#090b10,0_0_0_4px_#fff]'
						]}
					></button>
				{/each}
			</div>
		</div>

		<!-- Shape parameters (desktop) -->
		<div class="hidden space-y-3 border-t border-slate-800/80 pt-2 sm:block">
			<div class="px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
				Shape Parameters
			</div>

			<RangeControl label="Sub-Rings / Echoes" min={1} max={10} bind:value={studio.density} />
			<RangeControl
				label="Wave Reactivity"
				min={10}
				max={100}
				suffix="%"
				bind:value={studio.dynamicsPct}
			/>

			<label class="block space-y-1.5 rounded-xl border border-slate-800/80 bg-slate-900/70 p-2.5">
				<span class="block text-xs text-slate-300">Harp Tuning Scale</span>
				<select
					value={studio.scale}
					onchange={(e) => studio.setScale(e.currentTarget.value as ScaleName)}
					class="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
				>
					{#each scaleOptions as [value, scale] (value)}
						<option {value}>{scale.label}</option>
					{/each}
				</select>
			</label>
		</div>

		<!-- Hand gestures & video motion link (desktop) -->
		<div class="hidden space-y-2 border-t border-slate-800/80 pt-2 sm:block">
			<div
				class="flex items-center justify-between px-1 text-[10px] font-semibold tracking-wider text-cyan-400 uppercase"
			>
				<span>Hand Squeeze Gestures</span>
				<span class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
					{handBadge}
				</span>
			</div>

			<ToggleRow
				title="Pinch to Draw Wire"
				description="Uncheck to Play Only (no new wires)"
				highlight
				bind:checked={studio.handSqueezeDrawEnabled}
			/>
			<RangeControl
				label="Pinch Sensitivity"
				min={10}
				max={85}
				suffix="%"
				bind:value={studio.squeezeSensitivityPct}
			/>

			<div class="px-1 pt-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
				Video & Motion Link
			</div>
			<ToggleRow
				title="Video Motion Trigger"
				description="Movement in video plucks shapes"
				bind:checked={studio.motionTriggerEnabled}
			/>
			<ToggleRow
				title="Live Luma Contours"
				description="Extract video brightness rings"
				bind:checked={studio.lumaContoursEnabled}
			/>
			<ToggleRow
				title="Motion Sparkles"
				description="Show detected optical flow"
				bind:checked={studio.motionSparksEnabled}
			/>
		</div>
	</div>

	<!-- Presets, undo & clear -->
	<div class="space-y-1.5 border-t border-slate-800/80 pt-3">
		<div
			class="hidden px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:block"
		>
			Scene Presets
		</div>
		<div class="hidden grid-cols-2 gap-1.5 sm:grid">
			{#each PRESETS as preset (preset.id)}
				<button
					type="button"
					onclick={() => studio.loadPreset(preset.id)}
					class={[
						'truncate rounded-lg border border-slate-700/80 bg-slate-800/90 px-2 py-1.5 text-[11px] font-medium hover:bg-slate-700',
						preset.class
					]}
				>
					{preset.label}
				</button>
			{/each}
		</div>

		<div class="flex gap-1.5 pt-1">
			<button
				type="button"
				title="Remove Last Shape"
				aria-label="Undo: remove last shape"
				onclick={() => studio.undo()}
				class="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
			>
				<Icon name="undo" class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Undo</span>
			</button>
			<button
				type="button"
				title="Clear All Shapes"
				aria-label="Clear all shapes"
				onclick={() => studio.clearAll()}
				class="flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-800/60 bg-rose-950/60 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-900/70"
			>
				<Icon name="trash" class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Clear</span>
			</button>
		</div>
	</div>
</aside>
