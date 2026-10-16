export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/** Distance from point P to segment AB, plus the projected point on the segment */
export function pointToSegmentDist(
	px: number,
	py: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number
): { dist: number; projX: number; projY: number } {
	const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
	if (l2 === 0) return { dist: Math.hypot(px - x1, py - y1), projX: x1, projY: y1 };
	const t = clamp(((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2, 0, 1);
	const projX = x1 + t * (x2 - x1);
	const projY = y1 + t * (y2 - y1);
	return { dist: Math.hypot(px - projX, py - projY), projX, projY };
}

/** True when segment AB crosses segment CD */
export function segmentIntersection(
	ax: number,
	ay: number,
	bx: number,
	by: number,
	cx: number,
	cy: number,
	dx: number,
	dy: number
): boolean {
	const ccw = (p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number) =>
		(p3y - p1y) * (p2x - p1x) > (p2y - p1y) * (p3x - p1x);
	return (
		ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
		ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy)
	);
}
