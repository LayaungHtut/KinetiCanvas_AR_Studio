<script lang="ts">
	import { ICONS, type IconName } from './icons';

	let {
		name,
		class: className = 'h-4 w-4',
		strokeWidth = 2
	}: { name: IconName; class?: string; strokeWidth?: number } = $props();
</script>

<svg
	class={className}
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	viewBox="0 0 24 24"
	aria-hidden="true"
>
	{#each ICONS[name] as d (d)}
		<path stroke-linecap="round" stroke-linejoin="round" {d} />
	{/each}
</svg>
