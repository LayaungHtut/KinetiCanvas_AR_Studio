import { MOTION_H, MOTION_W } from '../constants';
import { clamp } from '../geometry';

/**
 * Real-time optical motion detection & luminance sampling on a low-resolution copy of the video.
 * Grids are indexed `y * MOTION_W + x` and sampled with normalized 0..1 coordinates.
 */
export class MotionAnalyzer {
	readonly motionGrid = new Float32Array(MOTION_W * MOTION_H);
	readonly lumaGrid = new Uint8Array(MOTION_W * MOTION_H);

	#ctx: CanvasRenderingContext2D;
	#prevFrame: Uint8ClampedArray | null = null;

	constructor() {
		const canvas = document.createElement('canvas');
		canvas.width = MOTION_W;
		canvas.height = MOTION_H;
		this.#ctx = canvas.getContext('2d', { willReadFrequently: true })!;
	}

	/** Analyzes one frame and returns the average motion level (0..100) */
	analyze(source: CanvasImageSource, mirror: boolean): number {
		const ctx = this.#ctx;
		ctx.save();
		if (mirror) {
			ctx.translate(MOTION_W, 0);
			ctx.scale(-1, 1);
		}
		ctx.drawImage(source, 0, 0, MOTION_W, MOTION_H);
		ctx.restore();

		const frame = ctx.getImageData(0, 0, MOTION_W, MOTION_H).data;
		const prev = (this.#prevFrame ??= new Uint8ClampedArray(frame));
		let totalMotion = 0;

		for (let i = 0, p = 0; i < frame.length; i += 4, p++) {
			const r = frame[i];
			const g = frame[i + 1];
			const b = frame[i + 2];

			// Perceived luminance (0..255)
			this.lumaGrid[p] = (r * 77 + g * 150 + b * 29) >> 8;

			const diff =
				(Math.abs(r - prev[i]) + Math.abs(g - prev[i + 1]) + Math.abs(b - prev[i + 2])) / (3 * 255);

			// Smooth motion decay
			const activeMotion = diff > 0.11 ? Math.min(1, diff * 2.6) : 0;
			this.motionGrid[p] = this.motionGrid[p] * 0.6 + activeMotion * 0.4;
			totalMotion += this.motionGrid[p];

			// Blend previous frame for temporal stability
			prev[i] = (prev[i] + r) >> 1;
			prev[i + 1] = (prev[i + 1] + g) >> 1;
			prev[i + 2] = (prev[i + 2] + b) >> 1;
		}

		return Math.min(100, Math.round((totalMotion / (MOTION_W * MOTION_H)) * 450));
	}

	motionAt(nx: number, ny: number): number {
		return this.motionGrid[cellIndex(nx, ny)] || 0;
	}

	/** Luminance at the point, 0..1 */
	lumaAt(nx: number, ny: number): number {
		return (this.lumaGrid[cellIndex(nx, ny)] || 0) / 255;
	}
}

function cellIndex(nx: number, ny: number): number {
	const gx = clamp(Math.floor(nx * MOTION_W), 0, MOTION_W - 1);
	const gy = clamp(Math.floor(ny * MOTION_H), 0, MOTION_H - 1);
	return gy * MOTION_W + gx;
}
