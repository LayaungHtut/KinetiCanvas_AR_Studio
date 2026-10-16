import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { SpatialSoundEngine } from './audio/sound-engine';
import {
	DEFAULT_COLOR,
	HAND_TOOL_PROMPTS,
	INITIAL_HUD_TEXT,
	PRESETS,
	SCALES,
	TOOL_PROMPTS
} from './constants';
import { MotionAnalyzer } from './engine/motion-analyzer';
import { dragShape, findNearestShape, ShapeFactory, shapeAnchor } from './engine/shapes';
import { ProceduralVideo } from './engine/synth-video';
import { clamp, segmentIntersection } from './geometry';
import { HandGestureController } from './hands/gesture-controller.svelte';
import { createHandTracker, type HandTracker } from './hands/mediapipe';
import { drawHandOverlay } from './render/hands';
import {
	drawBackground,
	drawDragPreview,
	drawLumaContours,
	drawMotionSparks,
	drawParticles,
	type DragPreview
} from './render/overlays';
import { drawShapes } from './render/shapes';
import type {
	HarpShape,
	Particle,
	Point,
	PresetName,
	ScaleName,
	Shape,
	ShapeHit,
	ShapeType,
	Tool,
	VideoMode
} from './types';

const TOAST_DURATION_MS = 2800;
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
	video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
	audio: false
};

/**
 * The whole studio: reactive UI state for the components, plus the canvas engine
 * (shapes, physics, video analysis, hand tracking, audio, recording).
 *
 * Simulation data (`shapes`, particles, hand landmarks) is intentionally plain, non-reactive data:
 * it is mutated every animation frame and only drawn to the canvas.
 */
export class Studio {
	// ---- Reactive UI state ----
	videoMode = $state<VideoMode>('synth');
	sourceBadge = $state('Synth Feed');
	mirrorVideo = $state(true);
	activeTool = $state<Tool>('harp');
	activeColor = $state(DEFAULT_COLOR);
	/** Sub-rings / echoes / strings per array */
	density = $state(4);
	dynamicsPct = $state(75);
	squeezeSensitivityPct = $state(35);
	scale = $state<ScaleName>('pentatonic');
	motionTriggerEnabled = $state(true);
	lumaContoursEnabled = $state(false);
	motionSparksEnabled = $state(true);
	handTrackingEnabled = $state(false);
	handTrackingLoading = $state(false);
	handSqueezeDrawEnabled = $state(true);
	audioEnabled = $state(true);
	isRecording = $state(false);
	hudText = $state(INITIAL_HUD_TEXT);
	toastMessage = $state('Ready');
	toastVisible = $state(false);
	shapeCount = $state(0);
	averageMotion = $state(0);
	lastNote = $state('--');
	selected = $state<{ id: number; type: ShapeType } | null>(null);
	playback = $state({ paused: true, currentTime: 0, duration: 0 });

	// ---- Engine ----
	readonly sound = new SpatialSoundEngine();
	readonly hands = new HandGestureController(this);
	shapes: Shape[] = [];
	/** Shape part currently grabbed by the pointer or a pinch in Edit mode */
	dragTarget: ShapeHit | null = null;

	#factory = new ShapeFactory();
	#particles: Particle[] = [];
	#pointer = {
		dragging: false,
		start: { x: 0, y: 0 },
		current: { x: 0, y: 0 },
		prev: { x: 0, y: 0 },
		hasPrev: false,
		contour: [] as Point[]
	};

	#canvas: HTMLCanvasElement | null = null;
	#ctx: CanvasRenderingContext2D | null = null;
	#video: HTMLVideoElement | null = null;
	#motion: MotionAnalyzer | null = null;
	#synth: ProceduralVideo | null = null;
	#frameId = 0;
	#stream: MediaStream | null = null;
	#uploadUrl: string | null = null;
	#tracker: HandTracker | null = null;
	#trackerBusy = false;
	#recorder: MediaRecorder | null = null;
	#toastTimer: ReturnType<typeof setTimeout> | undefined;

	get dynamics(): number {
		return this.dynamicsPct / 100;
	}

	get squeezeSensitivity(): number {
		return this.squeezeSensitivityPct / 100;
	}

	/** The camera feed is shown mirrored like a selfie view */
	get mirrored(): boolean {
		return this.mirrorVideo && this.videoMode === 'camera';
	}

	// =========================================================================
	// Lifecycle (attachments)
	// =========================================================================

	/** Attach to the main canvas: sizes it to its container and runs the render loop */
	attachCanvas: Attachment<HTMLCanvasElement> = (canvas) => untrack(() => this.#mount(canvas));

	/** Attach to the (hidden) video element used for camera & uploaded video playback */
	attachVideo: Attachment<HTMLVideoElement> = (video) => {
		this.#video = video;
		const sync = () => {
			this.playback.paused = video.paused;
			this.playback.currentTime = video.currentTime;
			this.playback.duration = Number.isFinite(video.duration) ? video.duration : 0;
		};
		const events = ['play', 'pause', 'timeupdate', 'loadedmetadata', 'emptied'] as const;
		for (const event of events) video.addEventListener(event, sync);
		return () => {
			for (const event of events) video.removeEventListener(event, sync);
			this.#video = null;
		};
	};

	#mount(canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		this.#canvas = canvas;
		this.#ctx = ctx;
		this.#motion = new MotionAnalyzer();
		this.#synth = new ProceduralVideo();

		const stage = canvas.parentElement ?? canvas;
		const resize = () => {
			canvas.width = stage.clientWidth;
			canvas.height = stage.clientHeight;
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(stage);

		this.loadPreset('full-symphony');
		this.#frameId = requestAnimationFrame(this.#frame);

		return () => {
			cancelAnimationFrame(this.#frameId);
			observer.disconnect();
			this.#dispose();
		};
	}

	#dispose(): void {
		if (this.#recorder?.state === 'recording') {
			this.#recorder.onstop = null;
			this.#recorder.stop();
		}
		this.#recorder = null;
		this.#releaseVideoSource();
		void this.#tracker?.close();
		this.#tracker = null;
		this.sound.dispose();
		clearTimeout(this.#toastTimer);
		this.#canvas = null;
		this.#ctx = null;
	}

	// =========================================================================
	// Render loop
	// =========================================================================

	#frame = (time: number): void => {
		const canvas = this.#canvas;
		const ctx = this.#ctx;
		const motion = this.#motion;
		const synth = this.#synth;
		if (!canvas || !ctx || !motion || !synth) return;

		const { width: w, height: h } = canvas;
		const video =
			this.videoMode !== 'synth' && this.#video && this.#video.readyState >= 2 ? this.#video : null;

		// 1. Current video source (falls back to the procedural stream while video loads)
		let source: CanvasImageSource;
		if (video) {
			source = video;
		} else {
			synth.render(time);
			source = synth.canvas;
		}

		const mirror = this.mirrored;
		drawBackground(ctx, source, mirror, w, h);

		// 2. Optical motion & luminance analysis
		this.averageMotion = motion.analyze(source, mirror);

		// 3. Physics & motion triggers
		this.#updateShapes(motion);
		this.#updateParticles();
		this.hands.update();

		// 4. Overlays & shapes
		if (this.lumaContoursEnabled) drawLumaContours(ctx, motion.lumaGrid, w, h);
		if (this.motionSparksEnabled) drawMotionSparks(ctx, motion.motionGrid, w, h);
		drawShapes(ctx, this.shapes, this.selected?.id ?? null, w, h, time);

		// 5. Hand tracking (one frame in flight at a time)
		if (video) this.#sendFrameToTracker(video);

		// 6. Drag preview, hand skeleton, particles
		const preview = this.#dragPreview();
		if (preview) drawDragPreview(ctx, preview, w, h);
		if (this.handTrackingEnabled) drawHandOverlay(ctx, this.hands.renderView(), w, h);
		drawParticles(ctx, this.#particles, w, h);

		this.#frameId = requestAnimationFrame(this.#frame);
	};

	#updateShapes(motion: MotionAnalyzer): void {
		const motionOn = this.motionTriggerEnabled;

		for (const shape of this.shapes) {
			if (shape.cooldown > 0) shape.cooldown--;

			if (shape.type === 'harp') {
				// Optical motion along the string plucks it
				if (motionOn && shape.cooldown === 0) {
					for (const t of [0.2, 0.5, 0.8]) {
						const sx = shape.x1 + (shape.x2 - shape.x1) * t;
						const sy = shape.y1 + (shape.y2 - shape.y1) * t;
						const m = motion.motionAt(sx, sy);
						if (m > 0.42) {
							this.triggerHarpPluck(shape, (Math.random() > 0.5 ? 1 : -1) * m * 0.055, sx, sy);
							break;
						}
					}
				}

				// 2nd-order harmonic oscillator spring
				shape.velocity = (shape.velocity - shape.tension * shape.displacement) * shape.damping;
				shape.displacement += shape.velocity;
				shape.glowIntensity *= 0.93;
			} else if (shape.type === 'contour') {
				shape.phase += 0.035;
				shape.energy *= 0.94;

				// Contour points breathe with the video's luminance
				let maxMotion = 0;
				shape.points.forEach((pt, idx) => {
					maxMotion = Math.max(maxMotion, motion.motionAt(pt.x, pt.y));
					const target =
						(motion.lumaAt(pt.x, pt.y) - 0.5) * 0.03 * shape.reactivity +
						Math.sin(shape.phase + idx * 0.5) * 0.004;
					pt.offset = pt.offset * 0.85 + target * 0.15;
				});

				if (motionOn && maxMotion > 0.45 && shape.cooldown === 0) {
					shape.energy = 1.0;
					shape.cooldown = 18;
					this.sound.playContourPulse(shapeAnchor(shape).y);
				}
			} else {
				shape.angle = (shape.angle + shape.speed) % (Math.PI * 2);

				// Scan along the sweep line for optical motion
				if (motionOn) {
					const sampleDist = (0.25 + Math.random() * 0.7) * shape.radius;
					const sx = shape.cx + Math.cos(shape.angle) * sampleDist;
					const sy = shape.cy + Math.sin(shape.angle) * sampleDist;
					const m = motion.motionAt(sx, sy);

					if (m > 0.36 && shape.blips.length < 8) {
						shape.blips.push({
							rx: (sx - shape.cx) / shape.radius,
							ry: (sy - shape.cy) / shape.radius,
							alpha: 1.0,
							val: Math.round(m * 99)
						});
						if (shape.cooldown === 0) {
							this.sound.playRadarPing(1.0 - shape.radius);
							shape.cooldown = 16;
							shape.pulseRadius = 0.01;
						}
					}
				}

				if (shape.pulseRadius > 0) {
					shape.pulseRadius += 0.035;
					if (shape.pulseRadius > 1.15) shape.pulseRadius = 0;
				}

				for (let b = shape.blips.length - 1; b >= 0; b--) {
					shape.blips[b].alpha -= 0.014;
					if (shape.blips[b].alpha <= 0) shape.blips.splice(b, 1);
				}
			}
		}
	}

	#updateParticles(): void {
		for (let i = this.#particles.length - 1; i >= 0; i--) {
			const p = this.#particles[i];
			p.x += p.vx;
			p.y += p.vy;
			p.life -= p.decay;
			if (p.life <= 0) this.#particles.splice(i, 1);
		}
	}

	#dragPreview(): DragPreview | null {
		const hs = this.hands.state;
		const base = { tool: this.activeTool, color: this.activeColor, density: this.density };
		if (this.handTrackingEnabled && hs.isPresent && hs.isSqueezing) {
			return { ...base, start: hs.dragStart, current: hs.dragCurrent, contour: hs.contourPoints };
		}
		const p = this.#pointer;
		if (p.dragging) {
			return { ...base, start: p.start, current: p.current, contour: p.contour };
		}
		return null;
	}

	#sendFrameToTracker(video: HTMLVideoElement): void {
		const tracker = this.#tracker;
		if (!this.handTrackingEnabled || !tracker || this.#trackerBusy) return;
		this.#trackerBusy = true;
		tracker
			.send({ image: video })
			.catch(() => {})
			.finally(() => {
				this.#trackerBusy = false;
			});
	}

	// =========================================================================
	// Shapes & effects
	// =========================================================================

	spawnParticles(x: number, y: number, color: string, count = 8): void {
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 0.0015 + Math.random() * 0.005;
			this.#particles.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 1.0,
				decay: 0.025 + Math.random() * 0.03,
				color,
				size: 2 + Math.random() * 3
			});
		}
	}

	triggerHarpPluck(shape: HarpShape, strength = 0.045, hitX?: number, hitY?: number): void {
		shape.velocity += strength;
		shape.glowIntensity = 1.0;
		shape.cooldown = 12;
		this.spawnParticles(
			hitX ?? (shape.x1 + shape.x2) * 0.5,
			hitY ?? (shape.y1 + shape.y2) * 0.5,
			shape.color,
			10
		);

		const note = this.sound.playHarpPluck(shape.pitchNorm, Math.min(1, Math.abs(strength) * 18));
		if (note) this.lastNote = note;
	}

	/** Places the shape drawn from `start` to `end` with the active tool (by pointer or pinch) */
	commitDrawing(start: Point, end: Point, contour: Point[], viaHand: boolean): void {
		const color = this.activeColor;
		const toast = (msg: string) => {
			if (viaHand) this.showToast(msg);
		};

		if (this.activeTool === 'harp') {
			const harp = this.#factory.harp(start.x, start.y, end.x, end.y, color, this.dynamics);
			if (harp) {
				this.shapes.push(harp);
				if (viaHand) this.triggerHarpPluck(harp, 0.05, end.x, end.y);
				else this.triggerHarpPluck(harp, 0.04);
				toast('Harp Wire anchored by Hand Gesture!');
			}
		} else if (this.activeTool === 'harparray') {
			const harps = this.#factory.harpArray(start, end, this.density, color, this.dynamics);
			if (harps.length > 0) {
				this.shapes.push(...harps);
				this.sound.playHarpPluck(viaHand ? 0.75 : 0.7, viaHand ? 0.8 : 0.7);
				toast('Multi-String Harp Array placed!');
			}
		} else if (this.activeTool === 'contour') {
			const shape = this.#factory.contour(contour, color, this.density, this.dynamics);
			if (shape) {
				this.shapes.push(shape);
				this.sound.playContourPulse(end.y);
				toast('Contour spline placed!');
			}
		} else if (this.activeTool === 'radar') {
			const rad = Math.hypot(end.x - start.x, end.y - start.y);
			const fallback = viaHand ? 0.13 : 0.12;
			this.shapes.push(
				this.#factory.radar(
					start.x,
					start.y,
					rad < 0.03 ? fallback : rad,
					color,
					this.density,
					this.dynamics
				)
			);
			this.sound.playRadarPing(viaHand ? 0.85 : 0.8);
			toast('Radar Ring placed!');
		}

		this.dragTarget = null;
		this.#syncShapes();
	}

	/** Removes a shape quietly */
	removeShape(shape: Shape): void {
		const idx = this.shapes.findIndex((s) => s.id === shape.id);
		if (idx === -1) return;
		this.shapes.splice(idx, 1);
		this.#syncShapes();
	}

	/** Severs a shape with sparks, sound and a toast */
	deleteShape(shape: Shape): void {
		if (shape.type === 'harp') {
			for (let t = 0; t <= 1; t += 0.2) {
				this.spawnParticles(
					shape.x1 + (shape.x2 - shape.x1) * t,
					shape.y1 + (shape.y2 - shape.y1) * t,
					'#f43f5e',
					5
				);
			}
		} else {
			const anchor = shapeAnchor(shape);
			this.spawnParticles(anchor.x, anchor.y, '#f43f5e', 16);
		}
		this.removeShape(shape);
		this.sound.playRadarPing(0.45);
		this.showToast('Wire severed & deleted!');
	}

	select(shape: Shape | null): void {
		this.selected = shape ? { id: shape.id, type: shape.type } : null;
	}

	#selectedShape(): Shape | undefined {
		const id = this.selected?.id;
		return id === undefined ? undefined : this.shapes.find((s) => s.id === id);
	}

	/** Keeps the reactive shape count & selection in sync with the plain shapes array */
	#syncShapes(): void {
		this.shapeCount = this.shapes.length;
		if (this.selected && !this.#selectedShape()) this.selected = null;
	}

	// =========================================================================
	// UI actions
	// =========================================================================

	selectTool(tool: Tool, { viaHand = false } = {}): void {
		this.activeTool = tool;
		this.hudText = (viaHand ? HAND_TOOL_PROMPTS : TOOL_PROMPTS)[tool];
		if (tool !== 'select') this.select(null);
	}

	/** Picks the drawing color, recoloring the selected shape too */
	setColor(color: string): void {
		this.activeColor = color;
		const selected = this.#selectedShape();
		if (selected) selected.color = color;
	}

	setScale(scale: ScaleName): void {
		this.scale = scale;
		this.sound.scale = scale;
		this.showToast(`Scale tuned to ${SCALES[scale].label}`);
	}

	loadPreset(name: PresetName): void {
		this.shapes = this.#factory.preset(name, this.dynamics);
		this.select(null);
		this.dragTarget = null;
		this.#syncShapes();
		const preset = PRESETS.find((p) => p.id === name);
		if (preset) this.showToast(preset.toast);
	}

	undo(): void {
		this.shapes.pop();
		this.select(null);
		this.#syncShapes();
	}

	clearAll(): void {
		this.shapes = [];
		this.select(null);
		this.#syncShapes();
		this.showToast('Cleared all shapes');
	}

	pulseSelected(): void {
		const s = this.#selectedShape();
		if (!s) return;
		if (s.type === 'harp') {
			this.triggerHarpPluck(s, 0.06);
		} else if (s.type === 'radar') {
			s.pulseRadius = 0.01;
			this.sound.playRadarPing(0.9);
		} else {
			s.energy = 1.0;
			this.sound.playContourPulse(0.5);
		}
	}

	deleteSelected(): void {
		const s = this.#selectedShape();
		if (s) this.removeShape(s);
		this.select(null);
	}

	toggleAudio(): void {
		this.audioEnabled = !this.audioEnabled;
		this.sound.enabled = this.audioEnabled;
		if (this.audioEnabled) this.sound.init();
	}

	toggleMirror(): void {
		this.mirrorVideo = !this.mirrorVideo;
		this.showToast(`Horizontal Mirror: ${this.mirrorVideo ? 'ON' : 'OFF'}`);
	}

	showToast(message: string): void {
		this.toastMessage = message;
		this.toastVisible = true;
		clearTimeout(this.#toastTimer);
		this.#toastTimer = setTimeout(() => (this.toastVisible = false), TOAST_DURATION_MS);
	}

	// =========================================================================
	// Pointer & keyboard input
	// =========================================================================

	#toNorm(e: PointerEvent): Point {
		const rect = this.#canvas!.getBoundingClientRect();
		return {
			x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
			y: clamp((e.clientY - rect.top) / rect.height, 0, 1)
		};
	}

	onPointerDown = (e: PointerEvent): void => {
		if (!this.#canvas) return;
		this.sound.init();
		const pt = this.#toNorm(e);

		// Right-click deletes the shape under the cursor
		if (e.button === 2) {
			const hit = findNearestShape(this.shapes, pt.x, pt.y);
			if (hit) this.deleteShape(hit.shape);
			return;
		}

		// Clicking an AR pad while hand tracking is on
		if (this.handTrackingEnabled) {
			const btn = this.hands.arButtonAt(pt);
			if (btn) {
				this.hands.activateArButton(btn.id);
				return;
			}
		}

		this.#canvas.setPointerCapture(e.pointerId);
		const p = this.#pointer;
		p.dragging = true;
		p.start = { ...pt };
		p.current = { ...pt };
		p.prev = { ...pt };
		p.hasPrev = true;

		if (this.activeTool === 'cut') {
			const hit = findNearestShape(this.shapes, pt.x, pt.y);
			if (hit) this.deleteShape(hit.shape);
		} else if (this.activeTool === 'select') {
			const hit = findNearestShape(this.shapes, pt.x, pt.y);
			this.select(hit?.shape ?? null);
			this.dragTarget = hit;
		} else if (this.activeTool === 'contour') {
			p.contour = [{ ...pt }];
		}
	};

	onPointerMove = (e: PointerEvent): void => {
		if (!this.#canvas) return;
		const pt = this.#toNorm(e);
		const p = this.#pointer;

		// Cutter: slice through any wire crossed while dragging
		if (this.activeTool === 'cut' && p.dragging) {
			for (let i = this.shapes.length - 1; i >= 0; i--) {
				const s = this.shapes[i];
				const crossed =
					s.type === 'harp' &&
					segmentIntersection(p.prev.x, p.prev.y, pt.x, pt.y, s.x1, s.y1, s.x2, s.y2);
				if (crossed || findNearestShape(this.shapes, pt.x, pt.y)?.shape.id === s.id) {
					this.deleteShape(s);
				}
			}
			p.prev = pt;
			return;
		}

		// The cursor plucks any harp string it crosses, dragging or not
		if (p.hasPrev) {
			const moveSpeed = Math.hypot(pt.x - p.prev.x, pt.y - p.prev.y);
			for (const s of this.shapes) {
				if (
					s.type === 'harp' &&
					segmentIntersection(p.prev.x, p.prev.y, pt.x, pt.y, s.x1, s.y1, s.x2, s.y2)
				) {
					this.triggerHarpPluck(s, clamp(moveSpeed * 1.4, 0.025, 0.08), pt.x, pt.y);
				}
			}
		}
		p.prev = pt;
		p.hasPrev = true;

		if (!p.dragging) return;
		const dx = pt.x - p.current.x;
		const dy = pt.y - p.current.y;
		p.current = { ...pt };

		if (this.activeTool === 'contour') {
			const last = p.contour.at(-1);
			if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 0.015) p.contour.push({ ...pt });
		} else if (this.activeTool === 'select' && this.dragTarget) {
			dragShape(this.dragTarget, pt, dx, dy);
		}
	};

	onPointerUp = (): void => {
		const p = this.#pointer;
		if (!p.dragging) return;
		p.dragging = false;
		this.commitDrawing(p.start, p.current, p.contour, false);
		p.contour = [];
	};

	/** Delete / Backspace removes the selected shape, or the last one */
	onKeyDown = (e: KeyboardEvent): void => {
		if (e.key !== 'Delete' && e.key !== 'Backspace') return;
		const target = e.target as HTMLElement | null;
		if (target?.closest('input, select, textarea, [contenteditable="true"]')) return;

		const shape = this.#selectedShape() ?? this.shapes.at(-1);
		if (shape) this.deleteShape(shape);
	};

	// =========================================================================
	// Video sources & hand tracking
	// =========================================================================

	async toggleHandTracking(): Promise<void> {
		if (this.handTrackingEnabled) {
			this.handTrackingEnabled = false;
			this.hands.reset();
			this.showToast('Hand Gesture Tracking paused.');
		} else {
			await this.#enableHandTracking();
		}
	}

	/** Live webcam; turns hand tracking on as well */
	async useCamera(): Promise<void> {
		if (!(await this.#startCamera())) {
			this.showToast('Camera access unavailable or denied. Using Demo Motion Stream.');
			return;
		}
		this.sourceBadge = 'LIVE CAMERA';
		if (!this.handTrackingEnabled) await this.#enableHandTracking();
		else this.showToast('Live Webcam & Hand Gestures Active!');
	}

	loadVideoFile(file: File): void {
		const video = this.#video;
		if (!video) return;
		this.#releaseVideoSource();
		this.#uploadUrl = URL.createObjectURL(file);
		video.src = this.#uploadUrl;
		video.play().catch(() => {});
		this.videoMode = 'upload';
		this.sourceBadge = 'VIDEO FILE';
		this.showToast(`Loaded video: ${file.name}`);
	}

	useDemoStream(): void {
		this.#releaseVideoSource();
		this.#video?.pause();
		this.videoMode = 'synth';
		this.sourceBadge = 'SYNTH FEED';
		this.showToast('Switched to Demo Motion Stream');
	}

	togglePlayback(): void {
		const video = this.#video;
		if (!video) return;
		if (video.paused) video.play().catch(() => {});
		else video.pause();
	}

	/** Seeks the uploaded video to a 0..1 fraction of its duration */
	seek(fraction: number): void {
		const video = this.#video;
		if (video?.duration) video.currentTime = fraction * video.duration;
	}

	async #enableHandTracking(): Promise<boolean> {
		if (this.handTrackingLoading) return false;
		this.handTrackingLoading = true;
		try {
			if (this.videoMode !== 'camera') {
				if (!(await this.#startCamera())) {
					this.showToast('Camera permission needed for live hand tracking.');
					return false;
				}
				this.sourceBadge = 'LIVE CAMERA + HANDS';
			}

			if (!this.#tracker) {
				this.showToast('Loading hand tracking model…');
				try {
					this.#tracker = await createHandTracker(this.hands.handleResults);
				} catch {
					this.showToast('Could not load the hand tracking model. Check your connection.');
					return false;
				}
			}

			this.handTrackingEnabled = true;
			this.showToast(
				'Hand Tracking Active! Squeeze/pinch your hand to start a wire, move, and release!'
			);
			return true;
		} finally {
			this.handTrackingLoading = false;
		}
	}

	async #startCamera(): Promise<boolean> {
		const video = this.#video;
		if (!video || !navigator.mediaDevices?.getUserMedia) return false;
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
		} catch {
			return false;
		}
		this.#releaseVideoSource();
		this.#stream = stream;
		video.srcObject = stream;
		try {
			await video.play();
		} catch {
			this.#releaseVideoSource();
			return false;
		}
		this.videoMode = 'camera';
		return true;
	}

	/** Stops the camera stream and frees any uploaded video */
	#releaseVideoSource(): void {
		const video = this.#video;
		this.#stream?.getTracks().forEach((t) => t.stop());
		this.#stream = null;
		if (video) video.srcObject = null;
		if (this.#uploadUrl) {
			video?.removeAttribute('src');
			video?.load();
			URL.revokeObjectURL(this.#uploadUrl);
			this.#uploadUrl = null;
		}
	}

	// =========================================================================
	// Export
	// =========================================================================

	takeSnapshot(): void {
		if (!this.#canvas) return;
		downloadUrl(this.#canvas.toDataURL('image/png'), `kineticanvas-${Date.now()}.png`);
		this.showToast('Snapshot saved as PNG!');
	}

	toggleRecording(): void {
		if (this.isRecording) {
			this.#recorder?.stop();
			this.isRecording = false;
			return;
		}
		if (!this.#canvas || typeof MediaRecorder === 'undefined') {
			this.showToast('Recording is not supported in this browser.');
			return;
		}

		this.sound.init();
		const stream = this.#canvas.captureStream(30);
		const audioTrack = this.sound.recordingDestination?.stream.getAudioTracks()[0];
		if (audioTrack) stream.addTrack(audioTrack);

		const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find((type) =>
			MediaRecorder.isTypeSupported(type)
		);
		const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
		const chunks: Blob[] = [];
		recorder.ondataavailable = (ev) => {
			if (ev.data.size > 0) chunks.push(ev.data);
		};
		recorder.onstop = () => {
			const type = recorder.mimeType || 'video/webm';
			const url = URL.createObjectURL(new Blob(chunks, { type }));
			const ext = type.includes('mp4') ? 'mp4' : 'webm';
			downloadUrl(url, `kineticanvas-session-${Date.now()}.${ext}`);
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			this.showToast('Video recording downloaded!');
		};
		recorder.start();
		this.#recorder = recorder;
		this.isRecording = true;
		this.showToast('Recording canvas + synth audio...');
	}
}

function downloadUrl(href: string, filename: string): void {
	const link = document.createElement('a');
	link.href = href;
	link.download = filename;
	link.click();
}
