<script lang="ts">
	import { getStudio } from '../kineticanvas/context';

	const studio = getStudio();
</script>

<div
	role="status"
	aria-live="polite"
	class={[
		'glass-panel pointer-events-none absolute right-4 bottom-4 z-40 flex items-center gap-2 rounded-xl border border-cyan-500/40 px-4 py-2.5 text-xs text-cyan-200 shadow-xl transition-opacity duration-300',
		!studio.toastVisible && 'opacity-0'
	]}
>
	<span class="h-2 w-2 rounded-full bg-cyan-400"></span>
	<span>{studio.toastMessage}</span>
</div>
