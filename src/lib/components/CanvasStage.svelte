<script lang="ts">
	import { getStudio } from '../kineticanvas/context';
	import HudBar from './HudBar.svelte';
	import SelectedInspector from './SelectedInspector.svelte';
	import ToastMessage from './ToastMessage.svelte';
	import VideoTransport from './VideoTransport.svelte';

	const studio = getStudio();
</script>

<section class="relative flex-1 overflow-hidden bg-slate-950">
	<!-- Source for camera & uploaded video; it is drawn onto the canvas, never shown directly -->
	<video {@attach studio.attachVideo} class="hidden" playsinline muted loop></video>

	<canvas
		{@attach studio.attachCanvas}
		aria-label="Interactive AR canvas: click and drag to draw shapes"
		class="absolute inset-0 block h-full w-full cursor-crosshair touch-none"
		onpointerdown={studio.onPointerDown}
		onpointermove={studio.onPointerMove}
		onpointerup={studio.onPointerUp}
		onpointercancel={studio.onPointerUp}
		oncontextmenu={(e) => e.preventDefault()}
	></canvas>

	<HudBar />
	<SelectedInspector />
	<VideoTransport />
	<ToastMessage />
</section>
