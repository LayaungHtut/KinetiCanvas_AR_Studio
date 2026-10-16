import { FINGERTIPS, HAND_CONNECTIONS } from '../constants';
import type { ArButton, HandLandmarks, SkeletonHit, Tool } from '../types';

export interface HandRenderView {
	activeTool: Tool;
	activeColor: string;
	drawEnabled: boolean;
	arButtons: ArButton[];
	skeletonHits: SkeletonHit[];
	hands: HandLandmarks[];
	/** Primary hand state; null when no hand is visible */
	primary: {
		x: number;
		y: number;
		isSqueezing: boolean;
		squeezeLevel: number;
		/** 0..1 progress of the pinch hold before a wire starts */
		holdProgress: number;
		/** 0..1 progress of the thumb+pinky tool-cycle gesture */
		cycleProgress: number;
	} | null;
}

const MONO_FONT = '"JetBrains Mono", monospace';

export function drawHandOverlay(
	ctx: CanvasRenderingContext2D,
	view: HandRenderView,
	w: number,
	h: number
): void {
	ctx.save();
	drawArButtons(ctx, view, w, h);
	drawSkeletonHits(ctx, view.skeletonHits, w, h);
	if (view.hands.length > 0) {
		drawSkeletons(ctx, view, w, h);
		drawReticle(ctx, view, w, h);
	}
	ctx.restore();
}

/** Hand-touchable shape tool & mode pads along the top of the video */
function drawArButtons(ctx: CanvasRenderingContext2D, view: HandRenderView, w: number, h: number) {
	for (const btn of view.arButtons) {
		const bx = (btn.x - btn.w * 0.5) * w;
		const by = (btn.y - btn.h * 0.5) * h;
		const bw = btn.w * w;
		const bh = btn.h * h;

		const isActive =
			(btn.tool !== null &&
				view.activeTool === btn.tool &&
				(btn.tool === 'cut' || btn.tool === 'select' || view.drawEnabled)) ||
			(btn.id === 'play_only' && !view.drawEnabled && view.activeTool !== 'cut');

		ctx.fillStyle = isActive ? 'rgba(15, 23, 42, 0.92)' : 'rgba(9, 11, 16, 0.72)';
		ctx.strokeStyle = isActive ? btn.color : 'rgba(148, 163, 184, 0.35)';
		ctx.lineWidth = isActive ? 2.4 : 1.2;
		ctx.shadowColor = btn.color;
		ctx.shadowBlur = isActive ? 12 : 0;

		ctx.beginPath();
		ctx.roundRect(bx, by, bw, bh, 9);
		ctx.fill();
		ctx.stroke();
		ctx.shadowBlur = 0;

		// Dwell progress while a fingertip hovers the pad
		if (btn.hover > 0) {
			ctx.fillStyle = btn.color;
			ctx.globalAlpha = 0.38;
			ctx.beginPath();
			ctx.roundRect(bx, by, bw * Math.min(1, btn.hover), bh, 9);
			ctx.fill();
			ctx.globalAlpha = 1.0;
		}

		const label =
			btn.id === 'play_only' ? (view.drawEnabled ? 'PLAY LOCK: OFF' : 'PLAY LOCK: ON') : btn.label;

		ctx.font = `600 9.5px ${MONO_FONT}`;
		ctx.fillStyle = isActive ? '#ffffff' : '#cbd5e1';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, btn.x * w, btn.y * h);
	}
	ctx.textAlign = 'start';
	ctx.textBaseline = 'alphabetic';
}

/** Expanding rings where bones/fingers plucked strings */
function drawSkeletonHits(
	ctx: CanvasRenderingContext2D,
	hits: SkeletonHit[],
	w: number,
	h: number
) {
	for (const hit of hits) {
		ctx.save();
		ctx.globalAlpha = hit.life;
		ctx.strokeStyle = '#ffffff';
		ctx.shadowColor = hit.color;
		ctx.shadowBlur = 16;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.arc(hit.x * w, hit.y * h, (1.2 - hit.life) * 28, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
	}
}

/** 21-point hand skeleton bones & joints */
function drawSkeletons(ctx: CanvasRenderingContext2D, view: HandRenderView, w: number, h: number) {
	const isCutMode = view.activeTool === 'cut';

	view.hands.forEach((hand, hIdx) => {
		ctx.strokeStyle = isCutMode
			? 'rgba(244, 63, 94, 0.85)'
			: hIdx === 0 && view.primary?.isSqueezing
				? 'rgba(255, 190, 11, 0.85)'
				: 'rgba(0, 242, 254, 0.72)';
		ctx.shadowColor = isCutMode ? '#f43f5e' : '#00f2fe';
		ctx.shadowBlur = 8;
		ctx.lineWidth = 2.5;

		for (const [i, j] of HAND_CONNECTIONS) {
			ctx.beginPath();
			ctx.moveTo(hand[i].x * w, hand[i].y * h);
			ctx.lineTo(hand[j].x * w, hand[j].y * h);
			ctx.stroke();
		}

		// Fingertips drawn larger so users see their plucking/cutting nodes
		hand.forEach((lm, idx) => {
			const isTip = (FINGERTIPS as readonly number[]).includes(idx);
			ctx.fillStyle = isTip ? '#ffffff' : isCutMode ? '#f43f5e' : '#00f2fe';
			ctx.beginPath();
			ctx.arc(lm.x * w, lm.y * h, isTip ? 5.5 : 3, 0, Math.PI * 2);
			ctx.fill();
		});
	});
}

/** Pinch / status reticle around the primary hand's thumb-index midpoint */
function drawReticle(ctx: CanvasRenderingContext2D, view: HandRenderView, w: number, h: number) {
	const hs = view.primary;
	if (!hs) return;

	const rx = hs.x * w;
	const ry = hs.y * h;
	const toolBadge = view.activeTool.toUpperCase();

	// Thumb + pinky tool-cycle progress ring
	if (hs.cycleProgress > 0 && view.hands[0]) {
		const pinky = view.hands[0][20];
		const px = pinky.x * w;
		const py = pinky.y * h;
		ctx.strokeStyle = '#a855f7';
		ctx.lineWidth = 3.5;
		ctx.beginPath();
		ctx.arc(px, py, 20, -Math.PI / 2, -Math.PI / 2 + hs.cycleProgress * Math.PI * 2);
		ctx.stroke();
		ctx.font = `600 10px ${MONO_FONT}`;
		ctx.fillStyle = '#e9d5ff';
		ctx.fillText('CYCLING TOOL...', px + 24, py + 4);
	}

	if (view.activeTool === 'cut') {
		ctx.strokeStyle = '#f43f5e';
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.arc(rx, ry, 18, 0, Math.PI * 2);
		ctx.stroke();
		ctx.font = `600 11px ${MONO_FONT}`;
		ctx.fillStyle = '#fda4af';
		ctx.fillText('[TOOL: CUTTER] TOUCH ANY SHAPE TO DELETE', rx + 24, ry + 4);
		return;
	}

	if (!view.drawEnabled) {
		ctx.font = `600 11px ${MONO_FONT}`;
		ctx.fillStyle = '#6ee7b7';
		ctx.fillText('[PLAY LOCK] STRUM WITH SKELETON | TOUCH TOP BAR FOR TOOLS', rx + 20, ry + 4);
		return;
	}

	const radius = hs.isSqueezing ? 14 : Math.max(16, 32 - hs.squeezeLevel * 16);
	ctx.shadowColor = hs.isSqueezing ? '#ffbe0b' : view.activeColor;
	ctx.shadowBlur = hs.isSqueezing ? 20 : 10;
	ctx.strokeStyle = hs.isSqueezing ? '#ffbe0b' : 'rgba(226, 232, 240, 0.5)';
	ctx.lineWidth = hs.isSqueezing ? 3 : 1.8;
	ctx.beginPath();
	ctx.arc(rx, ry, radius, 0, Math.PI * 2);
	ctx.stroke();

	// Pinch-hold confirmation arc
	if (!hs.isSqueezing && hs.holdProgress > 0) {
		ctx.strokeStyle = '#ffbe0b';
		ctx.lineWidth = 3.5;
		ctx.beginPath();
		ctx.arc(rx, ry, radius + 4, -Math.PI / 2, -Math.PI / 2 + hs.holdProgress * Math.PI * 2);
		ctx.stroke();
	}

	ctx.font = `600 11px ${MONO_FONT}`;
	ctx.fillStyle = hs.isSqueezing ? '#ffbe0b' : '#cbd5e1';
	ctx.fillText(
		hs.isSqueezing
			? `[${toolBadge}] LOCKED (OPEN HAND TO PLACE)`
			: hs.holdProgress > 0
				? `HOLD PINCH (${toolBadge})...`
				: `[TOOL: ${toolBadge}] PINCH TO DRAW | THUMB+PINKY CYCLES TOOL`,
		rx + radius + 8,
		ry + 4
	);
}
