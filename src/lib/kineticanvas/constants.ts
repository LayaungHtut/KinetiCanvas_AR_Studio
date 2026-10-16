import type { ArButton, PresetName, ScaleName, Tool } from './types';

/** Low-resolution buffer used for optical motion detection & luma contour extraction */
export const MOTION_W = 120;
export const MOTION_H = 68;

export const DEFAULT_COLOR = '#00f2fe';

export const COLOR_SWATCHES = [
	{ value: '#00f2fe', name: 'Cyber Cyan' },
	{ value: '#ffbe0b', name: 'Solar Gold' },
	{ value: '#10b981', name: 'Radar Emerald' },
	{ value: '#f43f5e', name: 'Laser Crimson' },
	{ value: '#a855f7', name: 'Plasma Violet' },
	{ value: '#f8fafc', name: 'Pure White' }
] as const;

export const SCALES: Record<ScaleName, { label: string; frequencies: number[] }> = {
	pentatonic: {
		label: 'Celestial Pentatonic',
		frequencies: [
			261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5
		]
	},
	hirajoshi: {
		label: 'Kyoto Hirajoshi',
		frequencies: [
			261.63, 277.18, 349.23, 392.0, 415.3, 523.25, 554.37, 698.46, 783.99, 830.61, 1046.5
		]
	},
	lydian: {
		label: 'Cosmic Lydian',
		frequencies: [
			261.63, 293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 739.99
		]
	},
	minor: {
		label: 'Cybernetic Harmonic Minor',
		frequencies: [
			220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 415.3, 440.0, 493.88, 523.25, 659.25
		]
	}
};

export const NOTE_NAMES = new Map<number, string>([
	[220.0, 'A3'],
	[246.94, 'B3'],
	[261.63, 'C4'],
	[277.18, 'C#4'],
	[293.66, 'D4'],
	[329.63, 'E4'],
	[349.23, 'F4'],
	[369.99, 'F#4'],
	[392.0, 'G4'],
	[415.3, 'G#4'],
	[440.0, 'A4'],
	[493.88, 'B4'],
	[523.25, 'C5'],
	[554.37, 'C#5'],
	[587.33, 'D5'],
	[659.25, 'E5'],
	[698.46, 'F5'],
	[739.99, 'F#5'],
	[783.99, 'G5'],
	[830.61, 'G#5'],
	[880.0, 'A5'],
	[1046.5, 'C6']
]);

export const TOOL_ORDER: Tool[] = ['harp', 'harparray', 'contour', 'radar', 'select', 'cut'];

export const TOOL_LABELS: Record<Tool, string> = {
	harp: 'Harp Strings',
	harparray: 'Harp Fan Array',
	contour: 'Contour Lines',
	radar: 'Radar Rings',
	select: 'Move & Edit',
	cut: 'Cut / Delete Wire'
};

export const INITIAL_HUD_TEXT =
	'Hover index finger on top AR pads (or pinch Thumb+Pinky) to switch Shape Tools! Pinch Thumb+Index to draw.';

/** HUD instructions shown when a tool is picked from the sidebar */
export const TOOL_PROMPTS: Record<Tool, string> = {
	harp: 'Touch strings with your hand skeleton to play! Pinch & hold thumb+index to draw a wire.',
	harparray: 'Pinch & drag a box (or click & drag) to span a Multi-String Laser Harp.',
	contour: 'Pinch & drag freehand to sketch flowing multi-echo Topographic Contours.',
	radar: 'Pinch & drag outward to place an active Sonar Radar Ring.',
	select: 'Click or pinch any Harp String, Contour, or Radar Ring to reposition or delete it.',
	cut: 'CUTTER ACTIVE: Swipe your hand skeleton or cursor across any wire to sever & delete it!'
};

/** HUD instructions shown when a tool is picked by hand gesture or AR pad */
export const HAND_TOOL_PROMPTS: Record<Tool, string> = {
	harp: 'Hover index finger on top AR pads (or pinch Thumb+Pinky) to switch Shape Tools! Pinch Thumb+Index to draw a Harp Wire.',
	harparray: 'Harp Fan Active: Pinch & drag a box in mid-air to span multiple tuned Harp Strings!',
	contour:
		'Contour Lines Active: Pinch & move your hand freehand to sketch flowing multi-echo Contours!',
	radar: 'Radar Rings Active: Pinch & pull outward to place an active Sonar Radar Ring!',
	select: 'Move / Edit Active: Pinch any Harp String, Contour, or Radar Ring to grab & move it.',
	cut: 'Cutter Active: Swipe your hand skeleton across any wire or shape to sever & delete it!'
};

export const PRESETS: { id: PresetName; label: string; toast: string; class: string }[] = [
	{
		id: 'harp-ensemble',
		label: 'Laser Harp',
		toast: 'Loaded Preset: Laser Harp Ensemble',
		class: 'text-amber-300'
	},
	{
		id: 'radar-command',
		label: 'Radar HUD',
		toast: 'Loaded Preset: Tactical Radar HUD',
		class: 'text-emerald-300'
	},
	{
		id: 'topo-flow',
		label: 'Topo Contours',
		toast: 'Loaded Preset: Topographic Contour Flow',
		class: 'text-cyan-300'
	},
	{
		id: 'full-symphony',
		label: 'Full Hybrid',
		toast: 'Loaded Preset: Hybrid AR Symphony',
		class: 'text-purple-300'
	}
];

export const HAND_CONNECTIONS: readonly (readonly [number, number])[] = [
	[0, 1],
	[1, 2],
	[2, 3],
	[3, 4], // Thumb
	[0, 5],
	[5, 6],
	[6, 7],
	[7, 8], // Index
	[5, 9],
	[9, 10],
	[10, 11],
	[11, 12], // Middle
	[9, 13],
	[13, 14],
	[14, 15],
	[15, 16], // Ring
	[13, 17],
	[0, 17],
	[17, 18],
	[18, 19],
	[19, 20] // Pinky & Palm
];

export const FINGERTIPS = [4, 8, 12, 16, 20] as const;

export function createArButtons(): ArButton[] {
	return [
		{
			id: 'tool_harp',
			tool: 'harp',
			label: '1. HARP WIRE',
			x: 0.11,
			y: 0.11,
			w: 0.11,
			h: 0.062,
			color: '#ffbe0b',
			hover: 0
		},
		{
			id: 'tool_harparray',
			tool: 'harparray',
			label: '2. HARP FAN',
			x: 0.23,
			y: 0.11,
			w: 0.11,
			h: 0.062,
			color: '#f97316',
			hover: 0
		},
		{
			id: 'tool_contour',
			tool: 'contour',
			label: '3. CONTOURS',
			x: 0.35,
			y: 0.11,
			w: 0.11,
			h: 0.062,
			color: '#00f2fe',
			hover: 0
		},
		{
			id: 'tool_radar',
			tool: 'radar',
			label: '4. RADAR RING',
			x: 0.47,
			y: 0.11,
			w: 0.11,
			h: 0.062,
			color: '#10b981',
			hover: 0
		},
		{
			id: 'tool_select',
			tool: 'select',
			label: '5. MOVE / EDIT',
			x: 0.59,
			y: 0.11,
			w: 0.11,
			h: 0.062,
			color: '#a855f7',
			hover: 0
		},
		{
			id: 'tool_cut',
			tool: 'cut',
			label: '6. CUT WIRE',
			x: 0.71,
			y: 0.11,
			w: 0.11,
			h: 0.062,
			color: '#f43f5e',
			hover: 0
		},
		{
			id: 'play_only',
			tool: null,
			label: 'PLAY LOCK',
			x: 0.825,
			y: 0.11,
			w: 0.095,
			h: 0.062,
			color: '#34d399',
			hover: 0
		},
		{
			id: 'undo_wire',
			tool: null,
			label: 'UNDO',
			x: 0.925,
			y: 0.11,
			w: 0.075,
			h: 0.062,
			color: '#94a3b8',
			hover: 0
		}
	];
}
