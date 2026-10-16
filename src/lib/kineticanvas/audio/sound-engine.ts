import { NOTE_NAMES, SCALES } from '../constants';
import { clamp } from '../geometry';
import type { ScaleName } from '../types';

/**
 * Web Audio polyphonic synthesizer.
 * Generates plucked harp acoustics, sonar radar pings, and contour harmonic swells.
 * The AudioContext is created lazily on the first user gesture.
 */
export class SpatialSoundEngine {
	enabled = true;
	scale: ScaleName = 'pentatonic';
	/** Mixed synth output, captured by the recorder so videos include sound */
	recordingDestination: MediaStreamAudioDestinationNode | null = null;

	#ctx: AudioContext | null = null;
	#master: GainNode | null = null;
	#lastNoteTime = 0;

	init(): AudioContext {
		if (!this.#ctx) {
			const AudioCtx =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			this.#ctx = new AudioCtx();
			this.#master = this.#ctx.createGain();
			this.#master.gain.value = 0.35;
			this.#master.connect(this.#ctx.destination);

			if (this.#ctx.createMediaStreamDestination) {
				this.recordingDestination = this.#ctx.createMediaStreamDestination();
				this.#master.connect(this.recordingDestination);
			}
		}
		if (this.#ctx.state === 'suspended') {
			void this.#ctx.resume();
		}
		return this.#ctx;
	}

	/** Plays a note and returns its name, '--' when muted, or null when throttled */
	playHarpPluck(normPitch = 0.5, velocity = 0.8): string | null {
		if (!this.enabled) return '--';
		const ctx = this.init();
		const now = ctx.currentTime;
		if (now - this.#lastNoteTime < 0.025) return null; // Prevent audio overload
		this.#lastNoteTime = now;

		const freq = this.#frequencyAt(normPitch);

		// Dual oscillator harmonic pluck (Triangle + Sine overtone)
		const osc1 = ctx.createOscillator();
		const osc2 = ctx.createOscillator();
		const filter = ctx.createBiquadFilter();
		const env = ctx.createGain();

		osc1.type = 'triangle';
		osc1.frequency.setValueAtTime(freq, now);

		osc2.type = 'sine';
		osc2.frequency.setValueAtTime(freq * 2, now);

		filter.type = 'lowpass';
		filter.frequency.setValueAtTime(freq * 6, now);
		filter.frequency.exponentialRampToValueAtTime(freq * 1.2, now + 1.4);

		const peak = clamp(velocity * 0.45, 0.1, 0.6);
		env.gain.setValueAtTime(0.001, now);
		env.gain.linearRampToValueAtTime(peak, now + 0.012);
		env.gain.exponentialRampToValueAtTime(0.0008, now + 1.65);

		osc1.connect(filter);
		osc2.connect(filter);
		filter.connect(env);
		env.connect(this.#master!);

		osc1.start(now);
		osc2.start(now);
		osc1.stop(now + 1.7);
		osc2.stop(now + 1.7);

		return NOTE_NAMES.get(freq) ?? `${Math.round(freq)}Hz`;
	}

	playRadarPing(pitchFactor = 1.0): void {
		if (!this.enabled) return;
		const ctx = this.init();
		const now = ctx.currentTime;
		if (now - this.#lastNoteTime < 0.06) return;
		this.#lastNoteTime = now;

		const osc = ctx.createOscillator();
		const env = ctx.createGain();
		const baseFreq = 1320 * (0.75 + pitchFactor * 0.5);

		osc.type = 'sine';
		osc.frequency.setValueAtTime(baseFreq, now);
		osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.96, now + 0.45);

		env.gain.setValueAtTime(0.001, now);
		env.gain.linearRampToValueAtTime(0.18, now + 0.008);
		env.gain.exponentialRampToValueAtTime(0.0005, now + 0.5);

		osc.connect(env);
		env.connect(this.#master!);
		osc.start(now);
		osc.stop(now + 0.55);
	}

	playContourPulse(normY = 0.5): void {
		if (!this.enabled) return;
		const ctx = this.init();
		const now = ctx.currentTime;
		if (now - this.#lastNoteTime < 0.05) return;
		this.#lastNoteTime = now;

		const freq = this.#frequencyAt(1 - normY) * 0.5;

		const osc = ctx.createOscillator();
		const env = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(freq, now);
		osc.frequency.linearRampToValueAtTime(freq * 1.015, now + 0.35);

		env.gain.setValueAtTime(0.001, now);
		env.gain.linearRampToValueAtTime(0.14, now + 0.05);
		env.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);

		osc.connect(env);
		env.connect(this.#master!);
		osc.start(now);
		osc.stop(now + 0.5);
	}

	dispose(): void {
		void this.#ctx?.close();
		this.#ctx = null;
		this.#master = null;
		this.recordingDestination = null;
	}

	#frequencyAt(norm: number): number {
		const freqs = SCALES[this.scale].frequencies;
		return freqs[clamp(Math.floor(norm * freqs.length), 0, freqs.length - 1)];
	}
}
