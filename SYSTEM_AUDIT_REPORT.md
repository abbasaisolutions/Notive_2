# Notive System Audit Report

**Date**: June 2025  
**Scope**: Embedding pipeline, LLM integration, dashboard metrics, voice transcription, visual design  
**Status**: Audit complete — critical fixes implemented

---

## Executive Summary

Notive's architecture is well-designed with strong cost-optimization foundations (local embeddings, deterministic NLP fallbacks, tiered model selection). This audit found **7 performance issues** and **5 cost-efficiency gaps** across the AI pipeline, plus visual polish opportunities. All critical fixes have been implemented.

### Changes Made (This Audit)

| # | Change | Impact | Files |
|---|--------|--------|-------|
| 1 | Wrap sync model.encode() in `asyncio.to_thread()` | Fixes event loop blocking under concurrent requests | `similarity-service/app/main.py` |
| 2 | Add startup model warmup | Eliminates 3-5s cold-start on first request | `similarity-service/app/main.py` |
| 3 | Add text truncation before embedding (2000 chars) | Prevents silent content loss at 512-token limit | `similarity-service/app/similarity_service.py` |
| 4 | Add max entries limit on /similarity (500) | Prevents unbounded memory/time with large requests | `similarity-service/app/main.py` |
| 5 | Remove dead `compute_cosine_similarity()` | Code cleanup | `similarity-service/app/similarity_service.py` |
| 6 | Add `response_format: { type: 'json_object' }` to 5 LLM calls | Eliminates JSON parse failures, saves wasted retry tokens | `tagging.service.ts`, `insight-engine.service.ts`, `guided-reflection.service.ts` |
| 7 | Truncate chat context (1500 chars/entry, 6000 total) | ~50-70% token savings on chat calls | `ai.service.ts`, `nlp.service.ts` |
| 8 | Add token usage logging to all LLM calls | Enables cost tracking and monitoring | `backend/src/config/ai.ts` |
| 9 | Add breathing animation to cold-start sprout doodle | Makes tier-0 empty state feel alive | `ColdStartGate.tsx` |
| 10 | Add notebook doodle support to EmptyState component | Allows contextual doodles instead of generic inbox icon | `empty-state.tsx` |

---

## 1. Similarity/Embedding Pipeline

### Architecture
- **Model**: BAAI/bge-small-en-v1.5 (384 dims, ~60-80MB)
- **Reranker**: cross-encoder/ms-marco-MiniLM-L6-v2 (~80-100MB)
- **Runtime**: FastAPI on port 8001, ONNX optional, lazy model loading
- **Cost**: $0 (fully local, CPU-only)

### Benchmarks (private eval, 51 entries / 25 queries)
| Mode | Recall@10 | MRR@10 | NDCG@10 | Latency |
|------|-----------|--------|---------|---------|
| Dense only | 1.0 | 0.946 | 0.959 | 110ms |
| Hybrid (dense+rerank) | 1.0 | 0.953 | 0.965 | 155ms |

### Issues Found & Fixed
- **Sync inference blocking event loop** → Fixed: `asyncio.to_thread()` wrapper
- **No model warmup** → Fixed: `@app.on_event("startup")` warmup
- **No token truncation** → Fixed: 2000-char truncation before embedding
- **No input size limit** → Fixed: 500-entry cap on /similarity
- **Dead code** → Fixed: removed unused `compute_cosine_similarity()`

### Remaining Recommendations
- Cross-encoder ONNX backend always falls back to torch (low priority — torch works fine)
- /similarity re-embeds ALL entries per request (backend should use /embed + stored vectors for O(1) lookup instead of O(n))

---

## 2. LLM Prompt Structure & Cost Efficiency

### Model Configuration
| Role | Model | Cost Tier |
|------|-------|-----------|
| Chat/Analysis | gpt-5-mini (env override) | Standard |
| Fallback | gpt-5-nano (env override) | Budget |
| Evidence synthesis | gpt-4o-mini | Budget |
| Insight scoring | gpt-4o-mini | Budget |
| Insight generation | gpt-4o-mini | Budget |
| Voice transcription | gpt-4o-mini-transcribe | Specialized |
| HuggingFace fallback | Mistral-7B-Instruct-v0.2 | Free |

### Complete LLM Call Inventory (15 call sites)

| # | Service | Purpose | Model | JSON Mode | Caching |
|---|---------|---------|-------|-----------|---------|
| 1 | ai.service | Sentiment | sentimentModel | No (single word) | None |
| 2 | ai.service | Journal chat (RAG) | chatModel | No (free text) | None |
| 3 | ai.service | Writing prompt | promptModel | No (free text) | None |
| 4 | nlp.service | Full NLP analysis | analysisModel | ✅ Yes | Content-hash skip |
| 5 | nlp.service | Evidence synthesis | evidenceModel | ✅ Yes | Self-disabling on 429 |
| 6 | nlp.service | Chat (RAG) | chatModel | No (free text) | None |
| 7 | tagging.service | Tag suggestions | taggingModel | ✅ **Added** | None |
| 8 | health-insights | Mood insight | healthModel | No (free text) | None |
| 9 | insight-engine | Quality scoring | insightScoringModel | ✅ **Added** | 24h DB cache |
| 10 | insight-engine | Insight generation | insightGenerationModel | ✅ **Added** | 24h DB cache |
| 11 | insight-engine | Weekly digest | insightDeepModel | ✅ **Added** | None |
| 12 | guided-reflection | Notive insights | promptModel | ✅ **Added** | Persisted to entry |
| 13 | voice-transcription | Transcription | voiceTranscriptionModel | json (audio API) | None |
| 14 | nlp.service | HuggingFace fallback | Mistral-7B | N/A | None |
| 15 | embedding.service | Embeddings | local/OpenAI | N/A | N/A |

### Issues Found & Fixed
- **5 calls expecting JSON without JSON mode** → Fixed: added `response_format: { type: 'json_object' }`
- **Untruncated context in chat calls** → Fixed: 1500 chars/entry + 6000 chars total cap
- **No token usage tracking** → Fixed: all calls now log prompt/completion/total tokens

### Cost Optimization Recommendations (Not Yet Implemented)

1. **Downgrade simple tasks to gpt-4o-mini**: Sentiment analysis, tagging, health insights, writing prompts — all return 1-2 sentences. Savings: ~60-70% on those calls.
2. **Cache sentiment results**: Same entry gets re-analyzed on repeated views. Add content-hash cache.
3. **Deduplicate RAG chat**: `ai.service.chatWithJournal` and `nlp.service.chat()` do the same thing with different prompts — consolidate.
4. **Connect prompt-learning service to LLM gating**: Track which insights users dismiss and skip generating similar ones.

### Prompt Injection Notes
- **Medium risk**: Journal chat functions inject user-written content into system prompts. Mitigated by output validation and the nature of the app (users only access their own data).
- **Low risk**: Classification/tagging calls validate output against allowlists.

---

## 3. Dashboard Metrics & KPIs

### Metrics Inventory (20 KPIs found)

| Category | Metrics | LLM Cost | Actionable? |
|----------|---------|----------|-------------|
| **Writing Activity** | Streak, entries, words, emotional range | Zero | Medium |
| **Mood Analysis** | Sparkline (14-day), mood-context correlations, trigger map, contradiction detection | Zero | Very High |
| **Self-Awareness** | Writer DNA archetype, emotional fingerprint (radar), resilience signal | Zero | High |
| **Growth** | Reflection depth meter (5 levels), growth mindset ratio, gratitude pulse | Zero | Very High |
| **Intelligence** | Vocabulary profile, life balance wheel, people map, writing voice, prime time | Zero | High |
| **Portfolio** | Evidence pipeline, skills growth, trend progression | Zero | Very High |
| **AI-Powered** | Hero insight (5 categories), weekly digest | LLM | Very High |
| **Gamification** | XP, levels, 13 badges, streak celebrations | Zero | High |

### Assessment
- **Mostly meaningful metrics** with strong actionability (mood correlations, trigger map, reflection depth, growth mindset)
- **Cold start handling is excellent** — 6-tier progressive disclosure system
- **Backend efficiency is good** — deterministic computation for 90%+ of metrics, LLM only for hero insight

### Gaps Identified

1. **Gamification is invisible on dashboard** — XP bar, level, badges exist in context but have no visible surface on the main page
2. **No week-over-week deltas** — all metrics show absolute values, not trends/changes
3. **No unified growth score** — 15+ metrics scattered across cards, no single "am I progressing?" answer
4. **No goal tracking system** — users can't set targets ("journal 5x/week")
5. **No portfolio bridge on dashboard** — career-track users see zero portfolio metrics on dashboard
6. **Analytics fetches ALL entries** — `prisma.entry.findMany` with no limit will degrade for power users (100+ entries)
7. **No streak recovery mechanic** — missing 1 day resets streak to 0

---

## 4. Voice Transcription Pipeline

### Architecture
```
Mic → MediaRecorder (WebM/Opus) → HTTP multipart → Backend job queue
                                                      ↓
                                        ┌─────────────┴─────────────┐
                                        │                           │
                                  faster-whisper              OpenAI API
                                  (local, $0)              ($0.003/min)
                                        └─────────────┬─────────────┘
                                                      ↓
                                          Polished transcript → NLP → Entry
```

### Strengths
- **Dual provider with automatic routing** — local (free) preferred when available
- **large-v3-turbo model with int8 quantization** — best quality/speed ratio on CPU
- **Multi-language candidate routing** — picks highest-scoring language
- **Hotword/lexicon system** — users store personal vocabulary for better accuracy
- **Capture quality monitoring** — detects quiet input, clipping, limited speech
- **Job retry system** — 4 attempts with exponential backoff
- **Live speech preview** — Web Speech API shows text while recording

### Cost: $0/transcription (with local service running)

### Gaps
- **No audio downsampling to 16kHz** before upload (Whisper's native rate — would save ~50% bandwidth)
- **No recording timer/duration indicator** in UI
- **No pause/resume** — only start/stop
- **No max duration warning** in UI (only server-side at 10/30 min)

---

## 5. UX Images & Visual Design

### Notebook Doodle System (12 inline SVGs) — **A+ Rating**
Zero network weight, ~8-12 path elements each, warm paper aesthetic with 5 accent palettes (sage, lilac, apricot, sky, amber). Used across dashboard, timeline, marketing, mobile nav, auth, admin.

### Photography (11 JPG files, ~2.8MB total)
Authentic, warm images used on auth pages and marketing showcase. All served via Next.js `<Image>` with auto-optimization.

### Changes Made
- **Cold-start sprout now breathes** — subtle 3s scale animation makes tier-0 feel alive
- **EmptyState component now supports notebook doodles** — `doodle` and `doodleAccent` props allow contextual illustrations instead of the generic inbox icon

### Visual Improvement Opportunities

| Priority | Issue | Impact |
|----------|-------|--------|
| Low | `image.jpg` (191KB) in public/images is unused — delete it | Saves 191KB |
| Low | Convert logo PNG to SVG (191KB → <5KB) | Sharper at all sizes |
| Low | Convert JPGs to WebP (save ~40-60% / ~1-1.5MB) | Faster page loads |
| Low | Skeleton loaders lack notebook texture treatment | Visual consistency |
| Low | Spinner is generic CSS — doesn't match doodle aesthetic | Brand alignment |

---

## 6. Python NLP Microservice

**Zero LLM cost.** Uses VADER (sentiment), YAKE (keywords), spaCy (NER), and optional HuggingFace transformers for advanced mode. Regex-based STAR evidence extraction. This is a well-designed cost saver that handles deterministic analysis locally.

---

## Cost Summary

| Component | Current Cost | After Optimizations |
|-----------|-------------|-------------------|
| Local embeddings (BGE) | $0 | $0 |
| Local STT (faster-whisper) | $0 | $0 |
| Python NLP (deterministic) | $0 | $0 |
| Dashboard metrics (95%) | $0 | $0 |
| LLM calls (OpenAI) | Variable | ~30-50% reduction via context truncation + JSON mode |

### Token Savings Estimate
- **Context truncation**: Saves ~50-70% tokens on chat calls (from unbounded to ~2000-6000 tokens/call)
- **JSON mode**: Eliminates retry tokens from parse failures (~5-10% of calls)
- **Usage logging**: Enables data-driven optimization going forward

---

## Recommended Next Steps (Priority Order)

### Quick Wins (Low Effort, High Value)
1. ✅ Done — Async model inference in similarity service
2. ✅ Done — Model warmup at startup
3. ✅ Done — JSON mode on 5 LLM calls
4. ✅ Done — Context truncation in chat calls
5. ✅ Done — Token usage logging

### Medium-Term (Moderate Effort)
6. Downgrade simple LLM tasks (sentiment, tagging, prompts) to gpt-4o-mini via env vars
7. Add gamification surface on dashboard (XP bar, level indicator, badge shelf)
8. Add week-over-week delta arrows to QuickPulseStrip metrics
9. Paginate entry fetches in analytics-summary.service.ts
10. Downsample audio to 16kHz before upload

### Long-Term (Higher Effort)
11. Replace /similarity's re-embed-all pattern with stored vector lookups
12. Build unified growth score from existing metrics
13. Add goal tracking system
14. Add streaming transcription for long recordings
15. Convert all photography to WebP and logo to SVG
