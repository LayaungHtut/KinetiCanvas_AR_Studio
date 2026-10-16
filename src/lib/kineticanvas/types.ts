export type Tool = 'harp' | 'harparray' | 'contour' | 'radar' | 'select' | 'cut';
export type VideoMode = 'synth' | 'camera' | 'upload';
export type ScaleName = 'pentatonic' | 'hirajoshi' | 'lydian' | 'minor';
export type PresetName = 'harp-ensemble' | 'radar-command' | 'topo-flow' | 'full-symphony';

/** All shape coordinates live in normalized 0..1 canvas space, so resizing never breaks alignment. */
export interface Point {
	x: number;
	y: number;
}

export interface HarpShape {
	id: number;
	type: 'harp';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	color: string;
	pitchNorm: number;
	/** Current perpendicular wave displacement */
	displacement: number;
	/** Spring velocity */
	velocity: number;
	tension: number;
	damping: number;
	glowIntensity: number;
	cooldown: number;
}

export interface ContourPoint extends Point {
	offset: number;
}

export interface ContourShape {
	id: number;
	type: 'contour';
	points: ContourPoint[];
	color: string;
	echoes: number;
	reactivity: number;
	phase: number;
	energy: number;
	cooldown: number;
}

export interface RadarBlip {
	rx: number;
	ry: number;
	alpha: number;
	val: number;
}

export interface RadarShape {
	id: number;
	type: 'radar';
	cx: number;
	cy: number;
	radius: number;
	color: string;
	rings: number;
	speed: number;
	angle: number;
	blips: RadarBlip[];
	pulseRadius: number;
	cooldown: number;
}

export type Shape = HarpShape | ContourShape | RadarShape;
export type ShapeType = Shape['type'];

export type ShapePart = 'p1' | 'p2' | 'body' | 'radius' | 'center';

export interface ShapeHit {
	shape: Shape;
	part: ShapePart;
}

export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	decay: number;
	color: string;
	size: number;
}

/** Visual contact flash where a skeleton bone plucked a string */
export interface SkeletonHit {
	x: number;
	y: number;
	color: string;
	life: number;
}

export interface Landmark {
	x: number;
	y: number;
	z: number;
}

/** 21 MediaPipe hand landmarks mapped into normalized canvas space */
export type HandLandmarks = Landmark[];

export type ArButtonId =
	| 'tool_harp'
	| 'tool_harparray'
	| 'tool_contour'
	| 'tool_radar'
	| 'tool_select'
	| 'tool_cut'
	| 'play_only'
	| 'undo_wire';

/** Hand-touchable pad drawn along the top of the video while hand tracking is on */
export interface ArButton {
	id: ArButtonId;
	tool: Tool | null;
	label: string;
	x: number;
	y: number;
	w: number;
	h: number;
	color: string;
	/** Fingertip dwell progress, 0..1 (negative = cooldown after trigger) */
	hover: number;
}
