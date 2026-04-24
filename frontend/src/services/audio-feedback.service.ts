/**
 * Audio microfeedback — procedural, subtle, opt-in.
 *
 * Synthesized with Web Audio API so we don't ship any binary assets. Every
 * sound is short (< 400ms) and low-volume; they're meant to feel like the
 * quiet physical sounds of a notebook, not UI notifications.
 *
 * All calls are safe no-ops when: disabled in settings, running SSR, or the
 * browser blocks AudioContext until user interaction.
 */

const STORAGE_KEY = 'notive_audio_feedback_enabled';

type SoundName = 'rustle' | 'scratch' | 'pageTurn' | 'seal';

let sharedContext: AudioContext | null = null;
let cachedEnabled: boolean | null = null;

function getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (sharedContext && sharedContext.state !== 'closed') return sharedContext;
    try {
        const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
        if (!Ctor) return null;
        sharedContext = new Ctor();
        return sharedContext;
    } catch {
        return null;
    }
}

export function isAudioFeedbackEnabled(): boolean {
    if (cachedEnabled !== null) return cachedEnabled;
    if (typeof window === 'undefined') return false;
    try {
        cachedEnabled = window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        cachedEnabled = false;
    }
    return cachedEnabled;
}

export function setAudioFeedbackEnabled(enabled: boolean): void {
    cachedEnabled = enabled;
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
        // ignore
    }
}

/** Short burst of filtered noise — paper-like "shh" */
function playRustle(ctx: AudioContext, durationMs = 140, peakGain = 0.05) {
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.max(1, Math.floor((durationMs / 1000) * sampleRate));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    // Pink-ish noise via running average of white noise
    let last = 0;
    for (let i = 0; i < frameCount; i += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2600;
    filter.Q.value = 0.9;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + durationMs / 1000 + 0.01);
}

/** Quick scratchy texture — a pen touching paper */
function playScratch(ctx: AudioContext) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    const noiseBuffer = ctx.createBuffer(1, Math.floor(0.12 * ctx.sampleRate), ctx.sampleRate);
    const nd = noiseBuffer.getChannelData(0);
    for (let i = 0; i < nd.length; i += 1) {
        nd[i] = (Math.random() * 2 - 1) * 0.35;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.16);
    noise.stop(now + 0.16);
}

/** Descending woody tone — a page being turned */
function playPageTurn(ctx: AudioContext) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
}

/** Soft felt click — a seal being set */
function playSeal(ctx: AudioContext) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
}

function play(sound: SoundName): void {
    if (!isAudioFeedbackEnabled()) return;
    const ctx = getContext();
    if (!ctx) return;
    try {
        if (ctx.state === 'suspended') {
            void ctx.resume();
        }
        switch (sound) {
            case 'rustle': playRustle(ctx); return;
            case 'scratch': playScratch(ctx); return;
            case 'pageTurn': playPageTurn(ctx); return;
            case 'seal': playSeal(ctx); return;
        }
    } catch {
        // Non-fatal — a blocked AudioContext is expected on first load
    }
}

export const audioFeedback = {
    rustle: () => play('rustle'),
    scratch: () => play('scratch'),
    pageTurn: () => play('pageTurn'),
    seal: () => play('seal'),
};
