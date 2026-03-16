import OpenAI from 'openai';
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import type { CreateEmbeddingResponse, EmbeddingCreateParams } from 'openai/resources/embeddings';

export type ActiveLlmVendor = 'openai' | 'disabled';
export type EmbeddingVendor = 'local_hash' | 'local_service' | 'openai';
export type AnalysisProvider = 'python' | 'deterministic' | 'llm';

const rawLlmProvider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
const isKnownLlmProvider = rawLlmProvider === '' || rawLlmProvider === 'openai' || rawLlmProvider === 'disabled' || rawLlmProvider === 'off' || rawLlmProvider === 'none';

if (rawLlmProvider && !isKnownLlmProvider) {
    console.warn(`Unsupported LLM_PROVIDER "${process.env.LLM_PROVIDER}". Falling back to disabled.`);
}

const openAiApiKey = (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '').trim();
const openAiClient = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null;

const requestedLlmVendor: ActiveLlmVendor =
    rawLlmProvider === '' || rawLlmProvider === 'openai'
        ? 'openai'
        : rawLlmProvider === 'disabled' || rawLlmProvider === 'off' || rawLlmProvider === 'none'
            ? 'disabled'
            : 'disabled';

const llmVendor: ActiveLlmVendor =
    requestedLlmVendor === 'disabled'
        ? 'disabled'
        : openAiClient
            ? 'openai'
            : 'disabled';

const defaultChatModel = process.env.LLM_MODEL || 'gpt-3.5-turbo';
const defaultFastModel = process.env.LLM_FAST_MODEL || defaultChatModel;
const embeddingServiceUrl = (process.env.EMBEDDING_SERVICE_URL || process.env.SIMILARITY_SERVICE_URL || '').trim().replace(/\/$/, '');
const rawEmbeddingProvider = (process.env.EMBEDDING_PROVIDER || '').trim().toLowerCase();
const embeddingVendor: EmbeddingVendor =
    rawEmbeddingProvider === 'openai'
        ? 'openai'
        : rawEmbeddingProvider === 'local_hash'
            ? 'local_hash'
            : rawEmbeddingProvider === 'local_service'
                ? 'local_service'
                : embeddingServiceUrl
                    ? 'local_service'
                    : 'local_hash';
const defaultEmbeddingModel =
    embeddingVendor === 'local_service'
        ? 'BAAI/bge-small-en-v1.5'
        : 'text-embedding-3-small';

export const aiRuntime = Object.freeze({
    llmVendor,
    chatModel: process.env.LLM_CHAT_MODEL || defaultChatModel,
    sentimentModel: process.env.LLM_SENTIMENT_MODEL || defaultFastModel,
    promptModel: process.env.LLM_PROMPT_MODEL || defaultFastModel,
    taggingModel: process.env.LLM_TAGGING_MODEL || defaultFastModel,
    analysisModel: process.env.LLM_ANALYSIS_MODEL || defaultFastModel,
    healthModel: process.env.LLM_HEALTH_MODEL || defaultFastModel,
    evidenceModel: process.env.LLM_EVIDENCE_MODEL || process.env.OPPORTUNITY_EVIDENCE_MODEL || 'gpt-4o-mini',
    embeddingVendor,
    embeddingModel: process.env.EMBEDDING_MODEL || defaultEmbeddingModel,
    embeddingServiceUrl,
});

export const hasLlmProvider = (): boolean => aiRuntime.llmVendor !== 'disabled' && !!openAiClient;

export const hasEmbeddingProvider = (): boolean => {
    if (aiRuntime.embeddingVendor === 'local_hash') return true;
    if (aiRuntime.embeddingVendor === 'local_service') return aiRuntime.embeddingServiceUrl.length > 0;
    return !!openAiClient;
};

export const createLlmChatCompletion = async (
    params: ChatCompletionCreateParamsNonStreaming
): Promise<ChatCompletion | null> => {
    if (!hasLlmProvider() || !openAiClient) return null;

    switch (aiRuntime.llmVendor) {
        case 'openai':
            return openAiClient.chat.completions.create(params);
        default:
            return null;
    }
};

export const createEmbedding = async (
    params: EmbeddingCreateParams
): Promise<CreateEmbeddingResponse | null> => {
    if (aiRuntime.embeddingVendor !== 'openai' || !openAiClient) return null;
    return openAiClient.embeddings.create(params);
};
