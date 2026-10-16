interface Orb {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	color1: string;
	color2: string;
}

/**
 * Procedural "demo motion stream" used when no camera or video file is active.
 * Glowing orbs drift across the frame so the motion triggers have something to react to.
 */
export class ProceduralVideo {
	readonly canvas: HTMLCanvasElement;
	#ctx: CanvasRenderingContext2D;
	#orbs: Orb[] = [
		{ x: 0.3, y: 0.5, vx: 0.0045, vy: 0.0032, r: 58, color1: '#38bdf8', color2: '#6366f1' },
		{ x: 0.7, y: 0.4, vx: -0.0038, vy: 0.0041, r: 48, color1: '#f43f5e', color2: '#f59e0b' },
		{ x: 0.5, y: 0.7, vx: 0.0031, vy: -0.0048, r: 42, color1: '#10b981', color2: '#06b6d4' }
	];

	constructor(width = 640, height = 360) {
		this.canvas = document.createElement('canvas');
		this.canvas.width = width;
		this.canvas.height = height;
		this.#ctx = this.canvas.getContext('2d')!;
	}

	render(time: number): void {
		const ctx = this.#ctx;
		const { width: w, height: h } = this.canvas;

		// Deep atmospheric studio backdrop
		const bgGrad = ctx.createLinearGradient(0, 0, w, h);
		bgGrad.addColorStop(0, '#070b14');
		bgGrad.addColorStop(0.5, '#0f172a');
		bgGrad.addColorStop(1, '#090d16');
		ctx.fillStyle = bgGrad;
		ctx.fillRect(0, 0, w, h);

		// Subtle perspective cyber floor & ceiling lines
		ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
		ctx.lineWidth = 1;
		const gridOffset = (time * 0.03) % 40;
		for (let x = -w; x < w * 2; x += 60) {
			ctx.beginPath();
			ctx.moveTo(w / 2 + (x - w / 2) * 0.2, 0);
			ctx.lineTo(x, h);
			ctx.stroke();
		}
		for (let y = gridOffset; y < h; y += 40) {
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
			ctx.stroke();
		}

		ctx.save();
		ctx.globalCompositeOperation = 'screen';

		// Kinetic energy orbs bouncing across the frame
		this.#orbs.forEach((orb, idx) => {
			orb.x += orb.vx;
			orb.y += orb.vy;
			if (orb.x < 0.12 || orb.x > 0.88) orb.vx *= -1;
			if (orb.y < 0.15 || orb.y > 0.85) orb.vy *= -1;

			const cx = orb.x * w + Math.sin(time * 0.002 + idx) * 25;
			const cy = orb.y * h + Math.cos(time * 0.0025 + idx) * 20;

			const radGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, orb.r * 1.6);
			radGrad.addColorStop(0, '#ffffff');
			radGrad.addColorStop(0.25, orb.color1);
			radGrad.addColorStop(0.65, orb.color2);
			radGrad.addColorStop(1, 'rgba(0,0,0,0)');

			ctx.fillStyle = radGrad;
			ctx.beginPath();
			ctx.arc(cx, cy, orb.r * 1.6, 0, Math.PI * 2);
			ctx.fill();
		});

		// Flowing central kinetic wave body
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
		ctx.lineWidth = 6;
		ctx.beginPath();
		for (let x = 60; x <= w - 60; x += 12) {
			const waveY = h * 0.5 + Math.sin(x * 0.015 + time * 0.004) * 75 * Math.sin(time * 0.0015);
			if (x === 60) ctx.moveTo(x, waveY);
			else ctx.lineTo(x, waveY);
		}
		ctx.stroke();
		ctx.restore();
	}
}
