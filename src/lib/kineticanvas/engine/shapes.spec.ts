import { describe, expect, it } from 'vitest';
import type { HarpShape } from '../types';
import { dragShape, findNearestShape, ShapeFactory } from './shapes';

describe('ShapeFactory', () => {
	it('ignores harp strings that are too short', () => {
		const factory = new ShapeFactory();
		expect(factory.harp(0.5, 0.5, 0.52, 0.5, '#fff', 0.75)).toBeNull();
	});

	it('gives every shape a unique id', () => {
		const factory = new ShapeFactory();
		const a = factory.harp(0.1, 0.1, 0.1, 0.9, '#fff', 0.75);
		const b = factory.radar(0.5, 0.5, 0.2, '#fff', 4, 0.75);
		expect(a?.id).not.toBe(b.id);
	});

	it('maps longer strings to lower pitches', () => {
		const factory = new ShapeFactory();
		const short = factory.harp(0.1, 0.1, 0.1, 0.3, '#fff', 0.75)!;
		const long = factory.harp(0.1, 0.1, 0.1, 0.9, '#fff', 0.75)!;
		expect(long.pitchNorm).toBeLessThan(short.pitchNorm);
	});

	it('clamps radar radius and ring count', () => {
		const radar = new ShapeFactory().radar(0.5, 0.5, 2, '#fff', 20, 0.5);
		expect(radar.radius).toBe(0.48);
		expect(radar.rings).toBe(8);
	});

	it('needs at least two points for a contour', () => {
		const factory = new ShapeFactory();
		expect(factory.contour([{ x: 0.5, y: 0.5 }], '#fff', 4, 0.75)).toBeNull();
		expect(
			factory.contour(
				[
					{ x: 0.1, y: 0.5 },
					{ x: 0.9, y: 0.5 }
				],
				'#fff',
				4,
				0.75
			)
		).not.toBeNull();
	});

	it('spans density + 2 strings in a harp array', () => {
		const harps = new ShapeFactory().harpArray(
			{ x: 0.1, y: 0.1 },
			{ x: 0.9, y: 0.9 },
			4,
			'#fff',
			0.75
		);
		expect(harps).toHaveLength(6);
		expect(harps[0].pitchNorm).toBe(0);
		expect(harps.at(-1)?.pitchNorm).toBe(1);
	});

	it.each(['harp-ensemble', 'radar-command', 'topo-flow', 'full-symphony'] as const)(
		'builds the %s preset',
		(name) => {
			expect(new ShapeFactory().preset(name, 0.75).length).toBeGreaterThan(0);
		}
	);
});

describe('findNearestShape', () => {
	const factory = new ShapeFactory();
	const harp = factory.harp(0.2, 0.2, 0.2, 0.8, '#fff', 0.75)!;
	const radar = factory.radar(0.7, 0.5, 0.2, '#fff', 4, 0.75);
	const shapes = [harp, radar];

	it('grabs harp endpoints and bodies', () => {
		expect(findNearestShape(shapes, 0.2, 0.2)?.part).toBe('p1');
		expect(findNearestShape(shapes, 0.2, 0.8)?.part).toBe('p2');
		expect(findNearestShape(shapes, 0.21, 0.5)?.part).toBe('body');
	});

	it('grabs radar rims and centers', () => {
		expect(findNearestShape(shapes, 0.9, 0.5)?.part).toBe('radius');
		expect(findNearestShape(shapes, 0.7, 0.5)?.part).toBe('center');
	});

	it('returns null on empty space', () => {
		expect(findNearestShape(shapes, 0.45, 0.05)).toBeNull();
	});
});

describe('dragShape', () => {
	it('moves a harp endpoint to the pointer', () => {
		const harp = new ShapeFactory().harp(0.2, 0.2, 0.2, 0.8, '#fff', 0.75) as HarpShape;
		dragShape({ shape: harp, part: 'p2' }, { x: 0.5, y: 0.9 }, 0, 0);
		expect([harp.x2, harp.y2]).toEqual([0.5, 0.9]);
	});

	it('translates a whole harp by the delta', () => {
		const harp = new ShapeFactory().harp(0.2, 0.2, 0.2, 0.8, '#fff', 0.75) as HarpShape;
		dragShape({ shape: harp, part: 'body' }, { x: 0, y: 0 }, 0.1, 0);
		expect(harp.x1).toBeCloseTo(0.3);
		expect(harp.x2).toBeCloseTo(0.3);
	});
});
