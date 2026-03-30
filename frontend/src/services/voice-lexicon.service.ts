export type VoiceLexiconItem = {
    id: string;
    canonical: string;
    normalized: string;
    aliases: string[];
    locale: string | null;
    itemType: string | null;
    boost: number;
    usageCount: number;
    lastUsedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

type ApiFetch = (path: string, options?: RequestInit & { retryOnUnauthorized?: boolean }) => Promise<Response>;

type UpsertVoiceLexiconItemInput = {
    canonical: string;
    aliases?: string[];
    locale?: string | null;
    itemType?: string | null;
    boost?: number;
};

const parseError = async (response: Response, fallbackMessage: string) => {
    const data = await response.json().catch(() => ({}));
    return new Error(data?.message || fallbackMessage);
};

export async function listVoiceLexiconItems(apiFetch: ApiFetch): Promise<VoiceLexiconItem[]> {
    const response = await apiFetch('/voice/lexicon');
    if (!response.ok) {
        throw await parseError(response, 'Failed to load voice lexicon.');
    }

    const data = await response.json().catch(() => ({}));
    return Array.isArray(data?.items) ? data.items as VoiceLexiconItem[] : [];
}

export async function upsertVoiceLexiconItem(
    apiFetch: ApiFetch,
    input: UpsertVoiceLexiconItemInput
): Promise<VoiceLexiconItem> {
    const response = await apiFetch('/voice/lexicon', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
    });

    if (!response.ok) {
        throw await parseError(response, 'Failed to save voice lexicon item.');
    }

    const data = await response.json().catch(() => ({}));
    return data.item as VoiceLexiconItem;
}

export async function deleteVoiceLexiconItem(apiFetch: ApiFetch, id: string): Promise<void> {
    const response = await apiFetch(`/voice/lexicon/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw await parseError(response, 'Failed to delete voice lexicon item.');
    }
}
