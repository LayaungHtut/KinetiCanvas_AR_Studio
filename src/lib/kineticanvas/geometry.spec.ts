import { describe, expect, it } from 'vitest';
import { clamp, pointToSegmentDist, segmentIntersection } from './geometry';

describe('clamp', () => {
	it('keeps values inside the range', () => {
		expect(clamp(-1, 0, 1)).toBe(0);
		expect(clamp(0.4, 0, 1)).toBe(0.4);
		expect(clamp(2, 0, 1)).toBe(1);
	});
});

describe('pointToSegmentDist', () => {
	it('projects onto the segment interior', () => {
		const r = pointToSegmentDist(0.5, 1, 0, 0, 1, 0);
		expect(r.dist).toBeCloseTo(1);
		expect(r.projX).toBeCloseTo(0.5);
		expect(r.projY).toBeCloseTo(0);
	});

	it('clamps the projection to the nearest endpoint', () => {
		const r = pointToSegmentDist(2, 0, 0, 0, 1, 0);
		expect(r.dist).toBeCloseTo(1);
		expect(r.projX).toBe(1);
	});

	it('handles zero-length segments', () => {
		expect(pointToSegmentDist(3, 4, 0, 0, 0, 0).dist).toBe(5);
	});
});

describe('segmentIntersection', () => {
	it('detects crossing segments', () => {
		expect(segmentIntersection(0, 0, 1, 1, 0, 1, 1, 0)).toBe(true);
	});

	it('rejects parallel and separated segments', () => {
		expect(segmentIntersection(0, 0, 1, 0, 0, 1, 1, 1)).toBe(false);
		expect(segmentIntersection(0, 0, 0.4, 0.4, 0.6, 0, 1, 0.4)).toBe(false);
	});
});
