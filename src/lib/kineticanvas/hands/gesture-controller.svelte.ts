import {
	createArButtons,
	FINGERTIPS,
	HAND_CONNECTIONS,
	TOOL_LABELS,
	TOOL_ORDER
} from '../constants';
import { findNearestShape, dragShape } from '../engine/shapes';
import { clamp, pointToSegmentDist, segmentIntersection } from '../geometry';
import type { HandRenderView } from '../render/hands';
import type { Studio } from '../studio.svelte';
import type { ArButton, ArButtonId, HandLandmarks, Point, Shape, SkeletonHit } from '../types';
import type { HandsResults } from './mediapipe';

/** Pinch must be held this many frames before a wire starts, so strumming never spawns wires */
const REQUIRED_HOLD_FRAMES = 5;
const TOOL_CYCLE_HOLD_FRAMES = 10;
const TOOL_CYCLE_COOLDOWN = 28;
/** Hysteresis thresholds on the smoothed squeeze level */
const START_THRESHOLD = 0.76;
const RELEASE_THRESHOLD = 0.48;

interface HandState {
	isPresent: boolean;
	isSqueezing: boolean;
	squeezeHoldFrames: number;
	/** 0.0 (open) to 1.0+ (tight pinch) */
	squeezeLevel: number;
	toolCycleHoldFrames: number;
	toolCycleCooldown: number;
	/** Smoothed normalized cursor (thumb-index midpoint) */
	x: number;
	y: number;
	prevX: number;
	prevY: number;
	/** Recent points while squeezing, so opening the hand doesn't shift the wire end */
	stableHistory: Point[];
	dragStart: Point;
	dragCurrent: Point;
	contourPoints: Point[];
	releaseCooldown: number;
}

/**
 * Turns MediaPipe hand landmarks into studio actions:
 * thumb+index pinch draws, the whole skeleton plucks/ripples/cuts shapes,
 * thumb+pinky pinch cycles tools, and fingertip dwell activates the AR pads.
 */
export class HandGestureController {
	// Reactive HUD state
	isPresent = $state(false);
	isSqueezing = $state(false);
	squeezePct = $state(0);

	readonly state: HandState = {
		isPresent: false,
		isSqueezing: false,
		squeezeHoldFrames: 0,
		squeezeLevel: 0,
		toolCycleHoldFrames: 0,
		toolCycleCooldown: 0,
		x: 0.5,
		y: 0.5,
		prevX: 0.5,
		prevY: 0.5,
		stableHistory: [],
		dragStart: { x: 0.5, y: 0.5 },
		dragCurrent: { x: 0.5, y: 0.5 },
		contourPoints: [],
		releaseCooldown: 0
	};
	readonly arButtons: ArButton[] = createArButtons();
	hands: HandLandmarks[] = [];
	skeletonHits: SkeletonHit[] = [];

	#prevHands: HandLandmarks[] = [];
	#studio: Studio;

	constructor(studio: Studio) {
		this.#studio = studio;
	}

	handleResults = (results: HandsResults): void => {
		const studio = this.#studio;
		const hs = this.state;

		// Keep the previous frame's skeleton for sweeping string-collision checks
		this.#prevHands = this.hands;
		this.hands = [];

		if (!results.multiHandLandmarks?.length) {
			if (hs.isSqueezing) this.#finishSqueeze();
			hs.isPresent = false;
			hs.squeezeHoldFrames = 0;
			hs.squeezeLevel = 0;
			this.#syncHud();
			return;
		}

		const mirror = studio.mirrored;
		this.hands = results.multiHandLandmarks.map((landmarks) =>
			landmarks.map((lm) => ({
				x: clamp(mirror ? 1 - lm.x : lm.x, 0, 1),
				y: clamp(lm.y, 0, 1),
				z: lm.z ?? 0
			}))
		);

		// 1. Full skeleton interactions with AR pads & shapes
		const touchedStringOrButton = this.#processSkeletonInteractions();

		// 2. Primary hand pinch detection for drawing new wires
		const primary = this.hands[0];
		hs.isPresent = true;
		if (hs.releaseCooldown > 0) hs.releaseCooldown--;

		// Scale-invariant hand size: wrist to index & middle MCP
		const wrist = primary[0];
		const indexMcp = primary[5];
		const middleMcp = primary[9];
		const palmScale = Math.max(
			0.045,
			(Math.hypot(indexMcp.x - wrist.x, indexMcp.y - wrist.y) +
				Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y)) *
				0.5
		);

		const thumbTip = primary[4];
		const indexTip = primary[8];
		const middleTip = primary[12];
		const pinkyTip = primary[20];

		if (hs.toolCycleCooldown > 0) hs.toolCycleCooldown--;

		// Mid-air thumb + pinky pinch (index extended) cycles shape tools hands-free
		const thumbPinkyDist =
			Math.hypot(
				thumbTip.x - pinkyTip.x,
				thumbTip.y - pinkyTip.y,
				(thumbTip.z - pinkyTip.z) * 0.5
			) / palmScale;
		const indexToThumbRatio =
			Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y) / palmScale;

		if (
			!hs.isSqueezing &&
			hs.toolCycleCooldown === 0 &&
			thumbPinkyDist < 0.34 &&
			indexToThumbRatio > 0.38
		) {
			hs.toolCycleHoldFrames++;
			if (hs.toolCycleHoldFrames >= TOOL_CYCLE_HOLD_FRAMES) {
				hs.toolCycleHoldFrames = 0;
				hs.toolCycleCooldown = TOOL_CYCLE_COOLDOWN;
				this.#cycleTool(pinkyTip.x, pinkyTip.y);
			}
		} else {
			hs.toolCycleHoldFrames = Math.max(0, hs.toolCycleHoldFrames - 1);
		}

		// Z depth is included so tilting an open hand sideways doesn't look like a 2D pinch.
		// ~0.12-0.22 of palm scale when truly pinched, ~0.55+ when strumming.
		const pinchRatio =
			Math.hypot(
				thumbTip.x - indexTip.x,
				thumbTip.y - indexTip.y,
				(thumbTip.z - indexTip.z) * 0.65
			) / palmScale;
		const middleToIndexDist =
			Math.hypot(middleTip.x - indexTip.x, middleTip.y - indexTip.y) / palmScale;

		// Pinch Sensitivity slider (0.10..0.85, default 0.35) controls how close thumb & index must be
		const pinchTriggerThresh = 0.14 + studio.squeezeSensitivity * 0.25;
		const rawPinchScore = clamp(1.0 - (pinchRatio - 0.1) / (pinchTriggerThresh * 1.15), 0, 1.2);
		hs.squeezeLevel = hs.squeezeLevel * 0.45 + rawPinchScore * 0.55;

		// Active interaction point: thumb-index midpoint, smoothed
		hs.prevX = hs.x;
		hs.prevY = hs.y;
		hs.x = hs.x * 0.45 + (thumbTip.x + indexTip.x) * 0.5 * 0.55;
		hs.y = hs.y * 0.45 + (thumbTip.y + indexTip.y) * 0.5 * 0.55;
		const handMoveSpeed = Math.hypot(hs.x - hs.prevX, hs.y - hs.prevY);

		const canDrawWithPinch = studio.handSqueezeDrawEnabled && studio.activeTool !== 'cut';

		if (!canDrawWithPinch) {
			hs.isSqueezing = false;
			hs.squeezeHoldFrames = 0;
		} else if (!hs.isSqueezing) {
			// Only count hold frames while the hand isn't slashing across a string
			const steadyPinch =
				hs.squeezeLevel >= START_THRESHOLD &&
				hs.releaseCooldown === 0 &&
				!touchedStringOrButton &&
				handMoveSpeed < 0.032 &&
				middleToIndexDist > 0.12;

			if (steadyPinch) {
				hs.squeezeHoldFrames++;
				if (hs.squeezeHoldFrames >= REQUIRED_HOLD_FRAMES) {
					// Deliberate pinch confirmed: anchor the wire start
					hs.isSqueezing = true;
					hs.squeezeHoldFrames = 0;
					hs.dragStart = { x: hs.x, y: hs.y };
					hs.dragCurrent = { x: hs.x, y: hs.y };
					hs.stableHistory = [{ x: hs.x, y: hs.y }];
					hs.contourPoints = [{ x: hs.x, y: hs.y }];

					studio.sound.playRadarPing(1.15);
					studio.spawnParticles(hs.x, hs.y, studio.activeColor, 10);
				}
			} else {
				hs.squeezeHoldFrames = Math.max(0, hs.squeezeHoldFrames - 1);
			}
		} else if (hs.squeezeLevel >= RELEASE_THRESHOLD) {
			this.#continueSqueeze();
		} else {
			// Pinch released: place the wire / shape
			this.#finishSqueeze();
		}

		this.#syncHud();
	};

	/** AR pad under a normalized point (used for mouse clicks on the pads) */
	arButtonAt(pt: Point): ArButton | undefined {
		return this.arButtons.find(
			(btn) => Math.abs(pt.x - btn.x) <= btn.w * 0.5 && Math.abs(pt.y - btn.y) <= btn.h * 0.5
		);
	}

	activateArButton(id: ArButtonId): void {
		const studio = this.#studio;
		studio.sound.playRadarPing(1.3);

		const btn = this.arButtons.find((b) => b.id === id);
		if (btn?.tool) {
			studio.selectTool(btn.tool, { viaHand: true });
			if (btn.tool !== 'cut' && btn.tool !== 'select') {
				studio.handSqueezeDrawEnabled = true;
				studio.activeColor = btn.color;
			}
			studio.spawnParticles(btn.x, btn.y, btn.color, 12);
			studio.showToast(`Shape Tool Selected: ${btn.label}`);
			return;
		}

		if (id === 'play_only') {
			studio.handSqueezeDrawEnabled = !studio.handSqueezeDrawEnabled;
			if (!studio.handSqueezeDrawEnabled && studio.activeTool === 'cut') {
				studio.selectTool('harp', { viaHand: true });
			}
			studio.showToast(
				studio.handSqueezeDrawEnabled
					? 'PINCH TO DRAW Enabled: Pinch thumb+index to draw wires!'
					: 'PLAY LOCK Active: Hand skeleton plays strings without creating new wires!'
			);
		} else if (id === 'undo_wire') {
			const last = studio.shapes.at(-1);
			if (last) {
				studio.removeShape(last);
				studio.spawnParticles(0.5, 0.5, last.color, 14);
				studio.showToast('Deleted last shape!');
			} else {
				studio.showToast('No shapes left to delete.');
			}
		}
	}

	/** Clears tracking state when hand tracking is switched off */
	reset(): void {
		this.hands = [];
		this.#prevHands = [];
		this.state.isPresent = false;
		this.state.isSqueezing = false;
		this.#syncHud();
	}

	/** Decays the contact flashes; called once per animation frame */
	update(): void {
		for (let i = this.skeletonHits.length - 1; i >= 0; i--) {
			this.skeletonHits[i].life -= 0.08;
			if (this.skeletonHits[i].life <= 0) this.skeletonHits.splice(i, 1);
		}
	}

	renderView(): HandRenderView {
		const studio = this.#studio;
		const hs = this.state;
		return {
			activeTool: studio.activeTool,
			activeColor: studio.activeColor,
			drawEnabled: studio.handSqueezeDrawEnabled,
			arButtons: this.arButtons,
			skeletonHits: this.skeletonHits,
			hands: this.hands,
			primary: hs.isPresent
				? {
						x: hs.x,
						y: hs.y,
						isSqueezing: hs.isSqueezing,
						squeezeLevel: hs.squeezeLevel,
						holdProgress: Math.min(1, hs.squeezeHoldFrames / REQUIRED_HOLD_FRAMES),
						cycleProgress: Math.min(1, hs.toolCycleHoldFrames / TOOL_CYCLE_HOLD_FRAMES)
					}
				: null
		};
	}

	/** Holding the pinch: the wire / contour / grabbed shape follows the hand */
	#continueSqueeze(): void {
		const studio = this.#studio;
		const hs = this.state;
		const cursor = { x: hs.x, y: hs.y };
		hs.dragCurrent = cursor;

		if (hs.squeezeLevel > 0.65) {
			hs.stableHistory.push(cursor);
			if (hs.stableHistory.length > 5) hs.stableHistory.shift();
		}

		if (studio.activeTool === 'contour') {
			const last = hs.contourPoints.at(-1);
			if (!last || Math.hypot(hs.x - last.x, hs.y - last.y) > 0.015) {
				hs.contourPoints.push(cursor);
			}
		} else if (studio.activeTool === 'select') {
			if (studio.dragTarget) {
				dragShape(studio.dragTarget, cursor, hs.x - hs.prevX, hs.y - hs.prevY);
			} else {
				const hit = findNearestShape(studio.shapes, hs.x, hs.y);
				if (hit) {
					studio.select(hit.shape);
					studio.dragTarget = hit;
				}
			}
		}
	}

	#finishSqueeze(): void {
		const hs = this.state;
		if (!hs.isSqueezing) return;
		hs.isSqueezing = false;
		hs.releaseCooldown = 8; // Prevent accidental double bounce

		// Use the stabilized endpoint from just before the fingers opened
		const end = hs.stableHistory[0] ?? hs.dragCurrent;
		this.#studio.commitDrawing(hs.dragStart, end, hs.contourPoints, true);
		hs.contourPoints = [];
		this.#studio.spawnParticles(end.x, end.y, '#ffffff', 12);
	}

	#cycleTool(fx: number, fy: number): void {
		const studio = this.#studio;
		const next = TOOL_ORDER[(TOOL_ORDER.indexOf(studio.activeTool) + 1) % TOOL_ORDER.length];

		studio.selectTool(next, { viaHand: true });
		if (next !== 'cut' && next !== 'select') {
			studio.handSqueezeDrawEnabled = true;
		}
		studio.sound.playRadarPing(1.35);
		studio.spawnParticles(fx, fy, studio.activeColor, 14);
		studio.showToast(`Hand Gesture Switched Tool: ${TOOL_LABELS[next]}`);
	}

	/** Returns true when the skeleton touched an AR pad or a shape this frame */
	#processSkeletonInteractions(): boolean {
		const studio = this.#studio;
		const isDrawingWire = this.state.isSqueezing;
		let interacted = false;

		// 1. Index fingertip dwell over the AR pads
		const primary = this.hands[0];
		if (primary && !isDrawingWire) {
			const indexTip = primary[8];
			for (const btn of this.arButtons) {
				const inside =
					Math.abs(indexTip.x - btn.x) <= btn.w * 0.5 &&
					Math.abs(indexTip.y - btn.y) <= btn.h * 0.5;
				if (inside) {
					interacted = true;
					btn.hover = Math.min(1, btn.hover + 0.08);
					if (btn.hover >= 1) {
						btn.hover = -0.6; // Cooldown after trigger
						this.activateArButton(btn.id);
					}
				} else {
					btn.hover = Math.max(0, btn.hover - 0.06);
				}
			}
		}

		if (isDrawingWire) return interacted;

		// 2. Every bone and joint of every hand against every shape
		this.hands.forEach((hand, hIdx) => {
			const prevHand = this.#prevHands[hIdx] ?? hand;

			// Cut mode: touching or slicing any shape with the skeleton deletes it
			if (studio.activeTool === 'cut') {
				for (let i = studio.shapes.length - 1; i >= 0; i--) {
					const shape = studio.shapes[i];
					if (skeletonTouchesShape(hand, shape)) {
						studio.deleteShape(shape);
						interacted = true;
					}
				}
				return;
			}

			for (const shape of studio.shapes) {
				if (shape.cooldown !== 0) continue;
				if (shape.type === 'harp') {
					const hit = findHarpHit(hand, prevHand, shape);
					if (hit) {
						interacted = true;
						const pluckAmp = clamp(hit.speed * 1.6, 0.032, 0.09);
						studio.triggerHarpPluck(shape, pluckAmp, hit.x, hit.y);
						this.skeletonHits.push({ x: hit.x, y: hit.y, color: shape.color, life: 1.0 });
					}
				} else if (shape.type === 'contour') {
					// Fingertips ripple contour lines they touch
					outer: for (const f of FINGERTIPS) {
						const tip = hand[f];
						for (const pt of shape.points) {
							if (Math.hypot(tip.x - pt.x, tip.y - pt.y) < 0.035) {
								shape.energy = 1.0;
								shape.cooldown = 15;
								pt.offset += 0.025;
								studio.sound.playContourPulse(pt.y);
								studio.spawnParticles(pt.x, pt.y, shape.color, 6);
								interacted = true;
								break outer;
							}
						}
					}
				} else {
					// Index fingertip touching the radar's outer ring pings it
					const indexTip = hand[8];
					const d = Math.hypot(indexTip.x - shape.cx, indexTip.y - shape.cy);
					if (Math.abs(d - shape.radius) < 0.025) {
						shape.pulseRadius = 0.01;
						shape.cooldown = 18;
						studio.sound.playRadarPing(1.0 - shape.radius);
						studio.spawnParticles(indexTip.x, indexTip.y, shape.color, 8);
						interacted = true;
					}
				}
			}
		});

		return interacted;
	}

	#syncHud(): void {
		this.isPresent = this.state.isPresent;
		this.isSqueezing = this.state.isSqueezing;
		this.squeezePct = this.state.isPresent
			? Math.min(100, Math.round(this.state.squeezeLevel * 100))
			: 0;
	}
}

/** Did any landmark or bone of the hand strike the harp string since the previous frame? */
function findHarpHit(
	hand: HandLandmarks,
	prevHand: HandLandmarks,
	s: Extract<Shape, { type: 'harp' }>
): { x: number; y: number; speed: number } | null {
	// A: a landmark crossed the string between frames
	for (let i = 0; i < hand.length; i++) {
		const curr = hand[i];
		const prev = prevHand[i] ?? curr;
		const moveDist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
		if (
			moveDist > 0.002 &&
			segmentIntersection(prev.x, prev.y, curr.x, curr.y, s.x1, s.y1, s.x2, s.y2)
		) {
			return { x: curr.x, y: curr.y, speed: moveDist };
		}
	}

	// B: a moving bone intersects the string, or a moving fingertip brushes it
	for (const [i, j] of HAND_CONNECTIONS) {
		const p1 = hand[i];
		const p2 = hand[j];
		const prevP1 = prevHand[i] ?? p1;
		const prevP2 = prevHand[j] ?? p2;
		const boneSpeed =
			(Math.hypot(p1.x - prevP1.x, p1.y - prevP1.y) +
				Math.hypot(p2.x - prevP2.x, p2.y - prevP2.y)) *
			0.5;

		if (boneSpeed > 0.004 && segmentIntersection(p1.x, p1.y, p2.x, p2.y, s.x1, s.y1, s.x2, s.y2)) {
			return { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5, speed: boneSpeed };
		}

		if (i === 4 || (FINGERTIPS as readonly number[]).includes(j)) {
			const tip = hand[j];
			const { dist, projX, projY } = pointToSegmentDist(tip.x, tip.y, s.x1, s.y1, s.x2, s.y2);
			if (dist < 0.018 && boneSpeed > 0.005) {
				return { x: projX, y: projY, speed: boneSpeed };
			}
		}
	}

	return null;
}

function skeletonTouchesShape(hand: HandLandmarks, shape: Shape): boolean {
	if (shape.type === 'harp') {
		for (const [i, j] of HAND_CONNECTIONS) {
			if (
				segmentIntersection(
					hand[i].x,
					hand[i].y,
					hand[j].x,
					hand[j].y,
					shape.x1,
					shape.y1,
					shape.x2,
					shape.y2
				)
			) {
				return true;
			}
		}
		return hand.some(
			(lm) => pointToSegmentDist(lm.x, lm.y, shape.x1, shape.y1, shape.x2, shape.y2).dist < 0.025
		);
	}
	if (shape.type === 'radar') {
		return hand.some((lm) => Math.hypot(lm.x - shape.cx, lm.y - shape.cy) < shape.radius * 0.9);
	}
	return hand.some((lm) => shape.points.some((pt) => Math.hypot(lm.x - pt.x, lm.y - pt.y) < 0.035));
}
