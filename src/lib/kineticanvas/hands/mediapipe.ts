/**
 * Lazy loader for MediaPipe Hands.
 * The library ships as a classic script that registers `window.Hands`, so it is injected from the
 * CDN on first use instead of being bundled (it also fetches its WASM/model files from there).
 */

const MEDIAPIPE_HANDS_VERSION = '0.4.1675469240';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}`;

export interface RawLandmark {
	x: number;
	y: number;
	z?: number;
}

export interface HandsResults {
	multiHandLandmarks?: RawLandmark[][];
}

export interface HandTracker {
	setOptions(options: {
		maxNumHands?: number;
		modelComplexity?: 0 | 1;
		minDetectionConfidence?: number;
		minTrackingConfidence?: number;
	}): void;
	onResults(callback: (results: HandsResults) => void): void;
	send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
	close(): Promise<void>;
}

type HandsConstructor = new (config: { locateFile: (file: string) => string }) => HandTracker;

declare global {
	interface Window {
		Hands?: HandsConstructor;
	}
}

let pending: Promise<HandsConstructor> | null = null;

function loadHandsScript(): Promise<HandsConstructor> {
	if (window.Hands) return Promise.resolve(window.Hands);

	pending ??= new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = `${CDN_BASE}/hands.js`;
		script.crossOrigin = 'anonymous';
		script.async = true;
		script.onload = () => {
			if (window.Hands) resolve(window.Hands);
			else reject(new Error('MediaPipe Hands script loaded but did not register window.Hands'));
		};
		script.onerror = () => {
			// Allow a retry on the next attempt
			pending = null;
			script.remove();
			reject(new Error('Failed to load MediaPipe Hands from CDN'));
		};
		document.head.append(script);
	});

	return pending;
}

export async function createHandTracker(
	onResults: (results: HandsResults) => void
): Promise<HandTracker> {
	const Hands = await loadHandsScript();
	const hands = new Hands({ locateFile: (file) => `${CDN_BASE}/${file}` });
	hands.setOptions({
		maxNumHands: 2,
		modelComplexity: 1,
		minDetectionConfidence: 0.65,
		minTrackingConfidence: 0.65
	});
	hands.onResults(onResults);
	return hands;
}
