<script lang="ts">
	import { setStudio } from '../kineticanvas/context';
	import { Studio } from '../kineticanvas/studio.svelte';
	import CanvasStage from './CanvasStage.svelte';
	import StudioHeader from './StudioHeader.svelte';
	import ToolSidebar from './ToolSidebar.svelte';

	const studio = setStudio(new Studio());
</script>

<svelte:window onkeydown={studio.onKeyDown} />

<div class="flex h-dvh w-screen flex-col overflow-hidden bg-slate-950 select-none">
	<StudioHeader />
	<main class="relative flex flex-1 overflow-hidden">
		<ToolSidebar />
		<CanvasStage />
	</main>
</div>
