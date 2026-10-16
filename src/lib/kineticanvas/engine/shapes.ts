import { clamp, pointToSegmentDist } from '../geometry';
import type {
	ContourShape,
	HarpShape,
	Point,
	PresetName,
	RadarShape,
	Shape,
	ShapeHit
} from '../types';

const MIN_HARP_LENGTH = 0.055;
const MIN_RADAR_RADIUS = 0.04;
const MAX_RADAR_RADIUS = 0.48;

/** Creates shapes with unique, increasing ids */
export class ShapeFactory {
	#nextId = 100;

	/** Returns null for tiny accidental taps/pinches */
	harp(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		color: string,
		dynamics: number,
		pitchNorm: number | null = null
	): HarpShape | null {
		const len = Math.hypot(x2 - x1, y2 - y1);
		if (len < MIN_HARP_LENGTH) return null;
		return {
			id: ++this.#nextId,
			type: 'harp',
			x1,
			y1,
			x2,
			y2,
			color,
			// Shorter strings sound higher unless the pitch is given explicitly
			pitchNorm: pitchNorm ?? clamp(1.0 - len * 0.85, 0.05, 0.95),
			displacement: 0,
			velocity: 0,
			tension: 0.18 + dynamics * 0.18,
			damping: 0.9,
			glowIntensity: 0,
			cooldown: 0
		};
	}

	contour(points: Point[], color: string, echoes: number, reactivity: number): ContourShape | null {
		if (points.length < 2) return null;
		return {
			id: ++this.#nextId,
			type: 'contour',
			points: points.map((p) => ({ x: p.x, y: p.y, offset: 0 })),
			color,
			echoes: clamp(echoes, 1, 8),
			reactivity,
			phase: Math.random() * Math.PI * 2,
			energy: 0,
			cooldown: 0
		};
	}

	radar(
		cx: number,
		cy: number,
		radius: number,
		color: string,
		rings: number,
		speed: number
	): RadarShape {
		return {
			id: ++this.#nextId,
			type: 'radar',
			cx,
			cy,
			radius: clamp(radius, MIN_RADAR_RADIUS, MAX_RADAR_RADIUS),
			color,
			rings: clamp(rings, 1, 8),
			speed: 0.015 + speed * 0.04,
			angle: Math.random() * Math.PI * 2,
			blips: [],
			pulseRadius: 0,
			cooldown: 0
		};
	}

	/** A box dragged from `start` to `end` spanning `density + 2` vertical strings */
	harpArray(
		start: Point,
		end: Point,
		density: number,
		color: string,
		dynamics: number
	): HarpShape[] {
		const wSpan = end.x - start.x;
		const hSpan = end.y - start.y;
		if (Math.hypot(wSpan, hSpan) <= 0.05) return [];
		const count = Math.max(2, density + 2);
		const harps: HarpShape[] = [];
		for (let i = 0; i < count; i++) {
			const t = i / (count - 1);
			const x = start.x + wSpan * t;
			const harp = this.harp(x, start.y, x, end.y, color, dynamics, t);
			if (harp) harps.push(harp);
		}
		return harps;
	}

	preset(name: PresetName, dynamics: number): Shape[] {
		const shapes: Shape[] = [];
		const push = (shape: Shape | null) => {
			if (shape) shapes.push(shape);
		};

		if (name === 'harp-ensemble') {
			const colors = [
				'#00f2fe',
				'#38bdf8',
				'#818cf8',
				'#c084fc',
				'#f472b6',
				'#fb7185',
				'#fbbf24',
				'#34d399'
			];
			const count = 8;
			for (let i = 0; i < count; i++) {
				const t = i / (count - 1);
				const xTop = 0.18 + t * 0.64;
				const xBot = 0.24 + t * 0.52;
				const yTop = 0.14 + Math.sin(t * Math.PI) * 0.06;
				const yBot = 0.86 - Math.sin(t * Math.PI) * 0.08;
				push(this.harp(xTop, yTop, xBot, yBot, colors[i % colors.length], dynamics, t));
			}
		} else if (name === 'radar-command') {
			push(this.radar(0.26, 0.48, 0.18, '#10b981', 4, 0.75));
			push(this.radar(0.74, 0.48, 0.18, '#00f2fe', 4, 0.6));
			push(this.radar(0.5, 0.25, 0.1, '#ffbe0b', 3, 0.9));
			// Lower topographic horizon line
			const horizon: Point[] = [];
			for (let x = 0.1; x <= 0.9; x += 0.08) {
				horizon.push({ x, y: 0.82 + Math.sin(x * 12) * 0.04 });
			}
			push(this.contour(horizon, '#10b981', 3, 0.8));
		} else if (name === 'topo-flow') {
			['#00f2fe', '#a855f7', '#ffbe0b'].forEach((color, wIdx) => {
				const pts: Point[] = [];
				const baseY = 0.28 + wIdx * 0.22;
				for (let x = 0.08; x <= 0.92; x += 0.06) {
					pts.push({ x, y: baseY + Math.sin(x * 8 + wIdx * 1.5) * 0.08 });
				}
				push(this.contour(pts, color, 5, 0.85));
			});
		} else if (name === 'full-symphony') {
			// Left Harp Fan
			for (let i = 0; i < 5; i++) {
				const t = i / 4;
				push(this.harp(0.12 + t * 0.22, 0.16, 0.1 + t * 0.18, 0.82, '#ffbe0b', dynamics, t));
			}
			// Right Radar Ring
			push(this.radar(0.76, 0.36, 0.17, '#10b981', 4, 0.7));
			// Flowing Spine Contour
			const spine: Point[] = [];
			for (let x = 0.38; x <= 0.9; x += 0.06) {
				spine.push({ x, y: 0.74 + Math.cos(x * 10) * 0.07 });
			}
			push(this.contour(spine, '#00f2fe', 4, 0.85));
		}

		return shapes;
	}
}

/** Topmost shape (last drawn) near the normalized point, with the part that was grabbed */
export function findNearestShape(shapes: Shape[], nx: number, ny: number): ShapeHit | null {
	for (let i = shapes.length - 1; i >= 0; i--) {
		const s = shapes[i];
		if (s.type === 'harp') {
			if (Math.hypot(nx - s.x1, ny - s.y1) < 0.035) return { shape: s, part: 'p1' };
			if (Math.hypot(nx - s.x2, ny - s.y2) < 0.035) return { shape: s, part: 'p2' };
			if (pointToSegmentDist(nx, ny, s.x1, s.y1, s.x2, s.y2).dist < 0.035) {
				return { shape: s, part: 'body' };
			}
		} else if (s.type === 'radar') {
			const dist = Math.hypot(nx - s.cx, ny - s.cy);
			if (Math.abs(dist - s.radius) < 0.035) return { shape: s, part: 'radius' };
			if (dist < s.radius) return { shape: s, part: 'center' };
		} else if (s.points.some((p) => Math.hypot(nx - p.x, ny - p.y) < 0.04)) {
			return { shape: s, part: 'body' };
		}
	}
	return null;
}

/** Moves the grabbed part of a shape: endpoints/radius follow `pt`, bodies shift by (dx, dy) */
export function dragShape({ shape, part }: ShapeHit, pt: Point, dx: number, dy: number): void {
	if (shape.type === 'harp') {
		if (part === 'p1') {
			shape.x1 = pt.x;
			shape.y1 = pt.y;
		} else if (part === 'p2') {
			shape.x2 = pt.x;
			shape.y2 = pt.y;
		} else {
			shape.x1 += dx;
			shape.y1 += dy;
			shape.x2 += dx;
			shape.y2 += dy;
		}
	} else if (shape.type === 'radar') {
		if (part === 'radius') {
			shape.radius = clamp(
				Math.hypot(pt.x - shape.cx, pt.y - shape.cy),
				MIN_RADAR_RADIUS,
				MAX_RADAR_RADIUS
			);
		} else {
			shape.cx += dx;
			shape.cy += dy;
		}
	} else {
		for (const p of shape.points) {
			p.x += dx;
			p.y += dy;
		}
	}
}

/** A representative point on the shape, used to place effects */
export function shapeAnchor(shape: Shape): Point {
	if (shape.type === 'harp') return { x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2 };
	if (shape.type === 'radar') return { x: shape.cx, y: shape.cy };
	return shape.points[Math.floor(shape.points.length / 2)] ?? { x: 0.5, y: 0.5 };
}
