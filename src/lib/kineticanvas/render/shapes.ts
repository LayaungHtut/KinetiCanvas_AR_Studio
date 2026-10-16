import type { ContourShape, HarpShape, RadarShape, Shape } from '../types';

export function drawShapes(
	ctx: CanvasRenderingContext2D,
	shapes: Shape[],
	selectedId: number | null,
	w: number,
	h: number,
	time: number
): void {
	for (const shape of shapes) {
		const isSelected = shape.id === selectedId;
		if (shape.type === 'harp') drawHarp(ctx, shape, isSelected, w, h);
		else if (shape.type === 'contour') drawContour(ctx, shape, isSelected, w, h, time);
		else drawRadar(ctx, shape, isSelected, w, h);
	}
}

function drawHarp(
	ctx: CanvasRenderingContext2D,
	shape: HarpShape,
	isSelected: boolean,
	w: number,
	h: number
): void {
	const minDim = Math.min(w, h);
	const px1 = shape.x1 * w;
	const py1 = shape.y1 * h;
	const px2 = shape.x2 * w;
	const py2 = shape.y2 * h;

	// Normal vector perpendicular to the string
	const dx = px2 - px1;
	const dy = py2 - py1;
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len;
	const ny = dx / len;
	const bend = shape.displacement * minDim;

	const midX = (px1 + px2) * 0.5 + nx * bend;
	const midY = (py1 + py2) * 0.5 + ny * bend;

	ctx.save();
	// Outer harmonic glow when vibrating
	ctx.shadowColor = shape.color;
	ctx.shadowBlur = 10 + shape.glowIntensity * 25;

	// Ghost overtone when vibrating strongly
	if (Math.abs(shape.displacement) > 0.002) {
		ctx.strokeStyle = shape.color;
		ctx.globalAlpha = 0.35;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(px1, py1);
		ctx.quadraticCurveTo(
			(px1 + px2) * 0.5 - nx * bend * 0.7,
			(py1 + py2) * 0.5 - ny * bend * 0.7,
			px2,
			py2
		);
		ctx.stroke();
	}

	// Main string curve
	ctx.globalAlpha = 0.95;
	ctx.strokeStyle = shape.glowIntensity > 0.2 ? '#ffffff' : shape.color;
	ctx.lineWidth = isSelected ? 3.5 : 2.2 + shape.glowIntensity * 2.5;
	ctx.beginPath();
	ctx.moveTo(px1, py1);
	ctx.quadraticCurveTo(midX, midY, px2, py2);
	ctx.stroke();

	// Anchor pins at both ends
	ctx.fillStyle = '#090b10';
	ctx.strokeStyle = shape.color;
	ctx.lineWidth = 2;
	for (const [ax, ay] of [
		[px1, py1],
		[px2, py2]
	]) {
		ctx.beginPath();
		ctx.arc(ax, ay, isSelected ? 6 : 4, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	}
	ctx.restore();
}

function drawContour(
	ctx: CanvasRenderingContext2D,
	shape: ContourShape,
	isSelected: boolean,
	w: number,
	h: number,
	time: number
): void {
	ctx.save();
	ctx.shadowColor = shape.color;
	ctx.shadowBlur = 8 + shape.energy * 18;

	// Multi-echo parallel topographic ribbons
	for (let e = 0; e < shape.echoes; e++) {
		const echoOffset = (e - (shape.echoes - 1) * 0.5) * 9;
		ctx.globalAlpha = (1 - (e / Math.max(1, shape.echoes)) * 0.65) * 0.9;
		ctx.strokeStyle = e === 0 && shape.energy > 0.3 ? '#ffffff' : shape.color;
		ctx.lineWidth = e === 0 ? (isSelected ? 3.2 : 2.2) : 1.2;

		if (e % 2 === 1) {
			ctx.setLineDash([10, 6]);
			ctx.lineDashOffset = -time * 0.03;
		} else {
			ctx.setLineDash([]);
		}

		ctx.beginPath();
		let prevX = 0;
		let prevY = 0;
		shape.points.forEach((pt, i) => {
			const px = pt.x * w + echoOffset + pt.offset * w;
			const py = pt.y * h + echoOffset + pt.offset * h;
			if (i === 0) ctx.moveTo(px, py);
			else ctx.quadraticCurveTo(prevX, prevY, (prevX + px) * 0.5, (prevY + py) * 0.5);
			prevX = px;
			prevY = py;
		});
		ctx.stroke();
	}
	ctx.setLineDash([]);

	// Control handle in Select mode
	if (isSelected && shape.points.length > 0) {
		const first = shape.points[0];
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(first.x * w, first.y * h, 6, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}

function drawRadar(
	ctx: CanvasRenderingContext2D,
	shape: RadarShape,
	isSelected: boolean,
	w: number,
	h: number
): void {
	const rPx = shape.radius * Math.min(w, h);

	ctx.save();
	ctx.translate(shape.cx * w, shape.cy * h);
	ctx.shadowColor = shape.color;
	ctx.shadowBlur = isSelected ? 18 : 8;

	// Concentric range rings
	for (let i = 1; i <= shape.rings; i++) {
		const isOuter = i === shape.rings;
		ctx.strokeStyle = shape.color;
		ctx.globalAlpha = isOuter ? 0.85 : 0.35;
		ctx.lineWidth = isOuter ? (isSelected ? 2.5 : 1.8) : 1;
		ctx.beginPath();
		ctx.arc(0, 0, (rPx / shape.rings) * i, 0, Math.PI * 2);
		ctx.stroke();
	}

	// Expanding sonar ping wave
	if (shape.pulseRadius > 0) {
		ctx.strokeStyle = '#ffffff';
		ctx.globalAlpha = Math.max(0, 1 - shape.pulseRadius);
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(0, 0, shape.pulseRadius * rPx, 0, Math.PI * 2);
		ctx.stroke();
	}

	// Crosshair axes & degree ticks
	ctx.strokeStyle = shape.color;
	ctx.globalAlpha = 0.25;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(-rPx, 0);
	ctx.lineTo(rPx, 0);
	ctx.moveTo(0, -rPx);
	ctx.lineTo(0, rPx);
	ctx.stroke();

	for (let deg = 0; deg < 360; deg += 15) {
		const rad = (deg * Math.PI) / 180;
		const inner = deg % 45 === 0 ? rPx - 8 : rPx - 4;
		ctx.beginPath();
		ctx.moveTo(Math.cos(rad) * inner, Math.sin(rad) * inner);
		ctx.lineTo(Math.cos(rad) * rPx, Math.sin(rad) * rPx);
		ctx.stroke();
	}

	// Rotating sweep line + trailing glow wedge
	ctx.save();
	ctx.rotate(shape.angle);
	const sweepGrad = ctx.createLinearGradient(0, 0, rPx, 0);
	sweepGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
	sweepGrad.addColorStop(1, shape.color);
	ctx.strokeStyle = sweepGrad;
	ctx.globalAlpha = 0.9;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(rPx, 0);
	ctx.stroke();

	ctx.fillStyle = shape.color;
	ctx.globalAlpha = 0.14;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.arc(0, 0, rPx, -0.45, 0);
	ctx.closePath();
	ctx.fill();
	ctx.restore();

	// Detected target blips with lock brackets
	for (const blip of shape.blips) {
		const bx = blip.rx * rPx;
		const by = blip.ry * rPx;
		ctx.globalAlpha = blip.alpha;
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
		ctx.fill();

		ctx.strokeStyle = shape.color;
		ctx.lineWidth = 1.2;
		ctx.strokeRect(bx - 7, by - 7, 14, 14);
	}

	ctx.restore();
}
