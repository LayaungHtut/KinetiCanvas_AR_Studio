import { MOTION_H, MOTION_W } from '../constants';
import type { Particle, Point, Tool } from '../types';

/** Draws the video frame (optionally mirrored) plus a dark vignette for neon contrast */
export function drawBackground(
	ctx: CanvasRenderingContext2D,
	source: CanvasImageSource,
	mirror: boolean,
	w: number,
	h: number
): void {
	ctx.save();
	if (mirror) {
		ctx.translate(w, 0);
		ctx.scale(-1, 1);
	}
	ctx.drawImage(source, 0, 0, w, h);
	ctx.restore();

	const vig = ctx.createRadialGradient(
		w * 0.5,
		h * 0.5,
		Math.min(w, h) * 0.35,
		w * 0.5,
		h * 0.5,
		Math.max(w, h) * 0.75
	);
	vig.addColorStop(0, 'rgba(0,0,0,0)');
	vig.addColorStop(1, 'rgba(5,8,17,0.45)');
	ctx.fillStyle = vig;
	ctx.fillRect(0, 0, w, h);
}

const LUMA_LEVELS = [
	{ threshold: 75, color: 'rgba(0, 242, 254, 0.35)' },
	{ threshold: 135, color: 'rgba(168, 85, 247, 0.45)' },
	{ threshold: 195, color: 'rgba(255, 190, 11, 0.55)' }
];

/** Iso-brightness edges extracted from the video's luma grid */
export function drawLumaContours(
	ctx: CanvasRenderingContext2D,
	lumaGrid: Uint8Array,
	w: number,
	h: number
): void {
	const cellW = w / MOTION_W;
	const cellH = h / MOTION_H;

	ctx.save();
	ctx.lineWidth = 1.25;
	for (const { threshold, color } of LUMA_LEVELS) {
		ctx.strokeStyle = color;
		ctx.beginPath();
		for (let y = 0; y < MOTION_H - 1; y++) {
			for (let x = 0; x < MOTION_W - 1; x++) {
				const idx = y * MOTION_W + x;
				const v0 = lumaGrid[idx] >= threshold;
				const v1 = lumaGrid[idx + 1] >= threshold;
				const v2 = lumaGrid[idx + MOTION_W] >= threshold;

				if (v0 !== v1) {
					ctx.moveTo((x + 0.5) * cellW, y * cellH);
					ctx.lineTo((x + 0.5) * cellW, (y + 1) * cellH);
				}
				if (v0 !== v2) {
					ctx.moveTo(x * cellW, (y + 0.5) * cellH);
					ctx.lineTo((x + 1) * cellW, (y + 0.5) * cellH);
				}
			}
		}
		ctx.stroke();
	}
	ctx.restore();
}

/** Dots wherever optical motion was detected */
export function drawMotionSparks(
	ctx: CanvasRenderingContext2D,
	motionGrid: Float32Array,
	w: number,
	h: number
): void {
	ctx.save();
	ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
	for (let y = 1; y < MOTION_H - 1; y += 2) {
		for (let x = 1; x < MOTION_W - 1; x += 2) {
			const m = motionGrid[y * MOTION_W + x];
			if (m > 0.32) {
				ctx.beginPath();
				ctx.arc((x / MOTION_W) * w, (y / MOTION_H) * h, m * 3.2, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
	ctx.restore();
}

export interface DragPreview {
	tool: Tool;
	color: string;
	density: number;
	start: Point;
	current: Point;
	contour: Point[];
}

/** Live preview of the shape being drawn by mouse/touch or by a held pinch */
export function drawDragPreview(
	ctx: CanvasRenderingContext2D,
	preview: DragPreview,
	w: number,
	h: number
): void {
	const sx = preview.start.x * w;
	const sy = preview.start.y * h;
	const cx = preview.current.x * w;
	const cy = preview.current.y * h;

	ctx.save();
	ctx.strokeStyle = preview.color;
	ctx.shadowColor = preview.color;
	ctx.shadowBlur = 16;

	if (preview.tool === 'harp') {
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(sx, sy, 6, 0, Math.PI * 2);
		ctx.fill();

		ctx.lineWidth = 3;
		ctx.setLineDash([8, 5]);
		ctx.beginPath();
		ctx.moveTo(sx, sy);
		ctx.lineTo(cx, cy);
		ctx.stroke();

		ctx.beginPath();
		ctx.arc(cx, cy, 6, 0, Math.PI * 2);
		ctx.fill();
	} else if (preview.tool === 'harparray') {
		const count = Math.max(2, preview.density + 2);
		ctx.lineWidth = 1.8;
		ctx.strokeRect(sx, sy, cx - sx, cy - sy);
		for (let i = 0; i < count; i++) {
			const lx = sx + (cx - sx) * (i / (count - 1));
			ctx.beginPath();
			ctx.moveTo(lx, sy);
			ctx.lineTo(lx, cy);
			ctx.stroke();
		}
	} else if (preview.tool === 'contour' && preview.contour.length > 1) {
		ctx.lineWidth = 2.8;
		ctx.beginPath();
		preview.contour.forEach((pt, idx) => {
			if (idx === 0) ctx.moveTo(pt.x * w, pt.y * h);
			else ctx.lineTo(pt.x * w, pt.y * h);
		});
		ctx.stroke();
	} else if (preview.tool === 'radar') {
		ctx.lineWidth = 2.2;
		ctx.setLineDash([5, 5]);
		ctx.beginPath();
		ctx.arc(sx, sy, Math.hypot(cx - sx, cy - sy), 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.restore();
}

export function drawParticles(
	ctx: CanvasRenderingContext2D,
	particles: Particle[],
	w: number,
	h: number
): void {
	ctx.save();
	for (const p of particles) {
		ctx.globalAlpha = p.life;
		ctx.fillStyle = p.color;
		ctx.shadowColor = p.color;
		ctx.shadowBlur = 8;
		ctx.beginPath();
		ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}
