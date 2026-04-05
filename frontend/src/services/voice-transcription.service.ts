export type VoiceLanguageMode =
    | 'auto'
    | 'en'
    | 'es'
    | 'fr'
    | 'ar'
    | 'ur'
    | 'pa'
    | 'hi'
    | 'bn'
    | 'fa'
    | 'tr'
    | 'de'
    | 'pt'
    | 'it'
    | 'zh'
    | 'ja'
    | 'ko'
    | 'en-ur'
    | 'en-pa'
    | 'en-ar'
    | 'other';

export type VoiceCaptureSource = 'backend_transcribe' | 'browser_fallback';
export type VoiceTranscriptionJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

export type VoiceCaptureQualityMetrics = {
    averageLevel?: number | null;
    peakLevel?: number | null;
    speechRatio?: number | null;
    clippedRatio?: number | null;
    framesObserved?: number | null;
    rating?: 'good' | 'review' | 'poor';
    issues?: string[];
};

export type VoiceTranscriptionResponse = {
    rawTranscript: string;
    cleanTranscript: string;
    detectedLanguage: string | null;
    source: VoiceCaptureSource;
    reviewRequired: boolean;
    captureMeta?: VoiceCaptureQualityMetrics | null;
    confidence?: {
        overall?: number;
        lowConfidenceSpans?: Array<{
            start: number;
            end: number;
            text: string;
        }>;
    };
    providerMeta?: {
        provider: string;
        model: string;
        latencyMs: number;
    };
};

export type VoiceTranscriptionJob = {
    id: string;
    entryId?: string | null;
    audioUrl: string;
    fileName?: string | null;
    mimeType: string;
    languageMode: string;
    candidateLanguages: string[];
    recordingDurationMs?: number | null;
    hintText?: string | null;
    entryContext?: string | null;
    status: VoiceTranscriptionJobStatus;
    provider?: string | null;
    model?: string | null;
    detectedLanguage?: string | null;
    attemptCount: number;
    maxAttempts: number;
    lastError?: string | null;
    createdAt: string;
    updatedAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    canceledAt?: string | null;
    captureMeta?: VoiceCaptureQualityMetrics | null;
    transcript?: VoiceTranscriptionResponse | null;
};

type ApiFetch = (path: string, options?: RequestInit & { retryOnUnauthorized?: boolean }) => Promise<Response>;

type CreateVoiceTranscriptionJobInput = {
    audioBlob: Blob;
    languageMode?: VoiceLanguageMode;
    candidateLanguages?: string[];
    hintText?: string | null;
    previewText?: string | null;
    entryContext?: string | null;
    recordingDurationMs?: number | null;
    captureMeta?: VoiceCaptureQualityMetrics | null;
    entryId?: string | null;
    filename?: string;
};

type AwaitVoiceJobOptions = {
    timeoutMs?: number;
    pollIntervalMs?: number;
    onJobUpdate?: (job: VoiceTranscriptionJob) => void;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildJobFormData = ({
    audioBlob,
    languageMode = 'auto',
    candidateLanguages,
    hintText,
    previewText,
    entryContext,
    recordingDurationMs,
    captureMeta,
    entryId,
    filename = 'voice-note.webm',
}: CreateVoiceTranscriptionJobInput) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, filename);
    formData.append('languageMode', languageMode);

    if (candidateLanguages && candidateLanguages.length > 0) {
        formData.append('candidateLanguages', candidateLanguages.join(','));
    }
    if (hintText?.trim()) {
        formData.append('hintText', hintText.trim());
    }
    if (previewText?.trim()) {
        formData.append('previewText', previewText.trim());
    }
    if (entryContext?.trim()) {
        formData.append('entryContext', entryContext.trim());
    }
    if (recordingDurationMs && Number.isFinite(recordingDurationMs) && recordingDurationMs > 0) {
        formData.append('recordingDurationMs', String(Math.round(recordingDurationMs)));
    }
    if (captureMeta) {
        formData.append('captureMeta', JSON.stringify(captureMeta));
    }
    if (entryId?.trim()) {
        formData.append('entryId', entryId.trim());
    }

    return formData;
};

const parseError = async (response: Response, fallbackMessage: string) => {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data?.message || fallbackMessage) as Error & {
        code?: string;
        retryable?: boolean;
    };
    error.code = data?.code;
    error.retryable = Boolean(data?.retryable);
    return error;
};

export async function createVoiceTranscriptionJob(
    apiFetch: ApiFetch,
    input: CreateVoiceTranscriptionJobInput
): Promise<VoiceTranscriptionJob> {
    const response = await apiFetch('/voice/jobs', {
        method: 'POST',
        body: buildJobFormData(input),
    });

    if (!response.ok) {
        throw await parseError(response, 'Couldn\u2019t start the voice transcription. Please try again.');
    }

    const data = await response.json().catch(() => ({}));
    return data.job as VoiceTranscriptionJob;
}

export async function getVoiceTranscriptionJob(
    apiFetch: ApiFetch,
    id: string
): Promise<VoiceTranscriptionJob> {
    const response = await apiFetch(`/voice/jobs/${id}`);
    if (!response.ok) {
        throw await parseError(response, 'Couldn\u2019t check the transcription status.');
    }

    const data = await response.json().catch(() => ({}));
    return data.job as VoiceTranscriptionJob;
}

export async function cancelVoiceTranscriptionJob(
    apiFetch: ApiFetch,
    id: string
): Promise<VoiceTranscriptionJob> {
    const response = await apiFetch(`/voice/jobs/${id}/cancel`, {
        method: 'POST',
    });
    if (!response.ok) {
        throw await parseError(response, 'Couldn\u2019t cancel the transcription.');
    }

    const data = await response.json().catch(() => ({}));
    return data.job as VoiceTranscriptionJob;
}

export async function attachVoiceTranscriptionJob(
    apiFetch: ApiFetch,
    id: string,
    entryId: string
): Promise<VoiceTranscriptionJob> {
    const response = await apiFetch(`/voice/jobs/${id}/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
    });
    if (!response.ok) {
        throw await parseError(response, 'Couldn\u2019t attach the transcription to your note.');
    }

    const data = await response.json().catch(() => ({}));
    return data.job as VoiceTranscriptionJob;
}

export async function awaitVoiceTranscriptionJob(
    apiFetch: ApiFetch,
    id: string,
    {
        timeoutMs = 120000,
        pollIntervalMs = 1800,
        onJobUpdate,
    }: AwaitVoiceJobOptions = {}
): Promise<VoiceTranscriptionJob> {
    const startedAt = Date.now();

    while (true) {
        const job = await getVoiceTranscriptionJob(apiFetch, id);
        onJobUpdate?.(job);

        if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELED') {
            return job;
        }

        if (Date.now() - startedAt > timeoutMs) {
            const error = new Error('Voice transcription is taking longer than expected.') as Error & {
                code?: string;
                retryable?: boolean;
                job?: VoiceTranscriptionJob;
            };
            error.code = 'VOICE_JOB_TIMEOUT';
            error.retryable = true;
            error.job = job;
            throw error;
        }

        await sleep(pollIntervalMs);
    }
}

export async function transcribeVoiceRecording(
    apiFetch: ApiFetch,
    input: CreateVoiceTranscriptionJobInput & AwaitVoiceJobOptions
): Promise<VoiceTranscriptionResponse> {
    const {
        timeoutMs,
        pollIntervalMs,
        onJobUpdate,
        ...createInput
    } = input;

    const createdJob = await createVoiceTranscriptionJob(apiFetch, createInput);
    onJobUpdate?.(createdJob);

    const finalJob = await awaitVoiceTranscriptionJob(apiFetch, createdJob.id, {
        timeoutMs,
        pollIntervalMs,
        onJobUpdate,
    });

    if (finalJob.status === 'COMPLETED' && finalJob.transcript) {
        return finalJob.transcript;
    }

    const error = new Error(finalJob.lastError || 'Voice transcription failed.') as Error & {
        code?: string;
        retryable?: boolean;
        job?: VoiceTranscriptionJob;
    };
    error.code = finalJob.status === 'CANCELED' ? 'VOICE_JOB_CANCELED' : 'VOICE_JOB_FAILED';
    error.retryable = finalJob.status !== 'CANCELED';
    error.job = finalJob;
    throw error;
}
