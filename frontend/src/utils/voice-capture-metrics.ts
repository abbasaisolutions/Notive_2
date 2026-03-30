import type { VoiceCaptureQualityMetrics } from '@/services/voice-transcription.service';

type VoiceCaptureMonitor = {
    stop: () => Promise<VoiceCaptureQualityMetrics | null>;
    dispose: () => void;
};

type VoiceCaptureMetricsOptions = {
    onLevel?: (level: number) => void;
};

type WebkitWindow = Window & typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
};

const getAudioContextCtor = () => {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || (window as WebkitWindow).webkitAudioContext || null;
};

export const createVoiceCaptureMonitor = async (
    stream: MediaStream,
    { onLevel }: VoiceCaptureMetricsOptions = {}
): Promise<VoiceCaptureMonitor | null> => {
    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) {
        return null;
    }

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.15;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const samples = new Float32Array(analyser.fftSize);
    let frameCount = 0;
    let speechFrames = 0;
    let clippedSamples = 0;
    let totalSamples = 0;
    let rmsAccumulator = 0;
    let peakLevel = 0;
    let animationFrame = 0;
    let disposed = false;

    const step = () => {
        if (disposed) {
            return;
        }

        analyser.getFloatTimeDomainData(samples);
        let sumSquares = 0;
        let framePeak = 0;

        for (let index = 0; index < samples.length; index += 1) {
            const sample = samples[index];
            const absolute = Math.abs(sample);
            sumSquares += sample * sample;
            framePeak = Math.max(framePeak, absolute);
            totalSamples += 1;
            if (absolute >= 0.985) {
                clippedSamples += 1;
            }
        }

        const rms = Math.sqrt(sumSquares / samples.length);
        frameCount += 1;
        rmsAccumulator += rms;
        peakLevel = Math.max(peakLevel, framePeak);
        if (rms >= 0.018) {
            speechFrames += 1;
        }

        onLevel?.(Math.min(1, rms * 4.5));
        animationFrame = window.requestAnimationFrame(step);
    };

    step();

    const finalize = async () => {
        if (disposed) {
            return null;
        }

        disposed = true;
        window.cancelAnimationFrame(animationFrame);
        onLevel?.(0);

        try {
            source.disconnect();
        } catch {
            // Ignore disconnect errors during cleanup.
        }

        try {
            analyser.disconnect();
        } catch {
            // Ignore disconnect errors during cleanup.
        }

        if (audioContext.state !== 'closed') {
            await audioContext.close().catch(() => undefined);
        }

        if (frameCount === 0 || totalSamples === 0) {
            return null;
        }

        const averageLevel = rmsAccumulator / frameCount;
        const speechRatio = speechFrames / frameCount;
        const clippedRatio = clippedSamples / totalSamples;
        const issues: string[] = [];

        if (speechRatio < 0.12) {
            issues.push('limited_speech_detected');
        }
        if (averageLevel < 0.015) {
            issues.push('input_too_quiet');
        }
        if (peakLevel > 0.985 || clippedRatio > 0.02) {
            issues.push('possible_clipping');
        }

        return {
            averageLevel: Number(averageLevel.toFixed(4)),
            peakLevel: Number(peakLevel.toFixed(4)),
            speechRatio: Number(speechRatio.toFixed(4)),
            clippedRatio: Number(clippedRatio.toFixed(4)),
            framesObserved: frameCount,
            rating: issues.length >= 2 ? 'poor' : issues.length === 1 ? 'review' : 'good',
            issues,
        } satisfies VoiceCaptureQualityMetrics;
    };

    return {
        stop: finalize,
        dispose: () => {
            void finalize();
        },
    };
};

export default createVoiceCaptureMonitor;
