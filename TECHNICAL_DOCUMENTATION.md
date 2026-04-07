# Notive - Technical Documentation

## Academic Project Submission for NLP Course

**Application:** Notive - AI-Powered Journaling Platform  
**Version:** 0.1.0  
**Documentation Date:** January 2026  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Overall System Architecture](#2-overall-system-architecture)
3. [Detailed Feature Breakdown](#3-detailed-feature-breakdown)
4. [AI & NLP Components](#4-ai--nlp-components)
5. [NLP Processing Pipeline](#5-nlp-processing-pipeline)
6. [Knowledge Base & Retrieval Design](#6-knowledge-base--retrieval-design)
7. [API Design & Routes](#7-api-design--routes)
8. [Database Schema & Data Modeling](#8-database-schema--data-modeling)
9. [Security & Privacy Considerations](#9-security--privacy-considerations)
10. [Performance & Scalability](#10-performance--scalability)
11. [Limitations & Technical Challenges](#11-limitations--technical-challenges)
12. [Future Improvements](#12-future-improvements)
13. [Academic Relevance](#13-academic-relevance)

---

## 1. Project Overview

### 1.1 Application Name and Purpose

**Notive** is an AI-powered personal journaling application that combines traditional journaling with modern Natural Language Processing (NLP) capabilities. The platform enables users to document their thoughts, emotions, and daily experiences while leveraging AI to provide intelligent insights, semantic search, and conversational interaction with their journal history.

### 1.2 Problem Statement

Traditional journaling applications offer basic text storage without meaningful analysis of the content users create. Users accumulate months or years of entries but lack tools to:

1. **Search semantically** - Finding entries about "feeling down" should match entries containing "sad", "depressed", or "melancholy"
2. **Understand patterns** - Identifying recurring themes, mood trends, and life patterns
3. **Interact naturally** - Asking questions about past entries in natural language
4. **Get automated insights** - Extracting lessons, skills, and reflections without manual tagging
5. **Correlate external factors** - Connecting health metrics (sleep, activity) with emotional states

Notive addresses these gaps by integrating multiple NLP techniques into the journaling workflow.

### 1.3 Target Users

- **Personal journalers** seeking deeper self-reflection through AI-assisted insights
- **Mental health enthusiasts** tracking mood patterns and emotional wellness
- **Life coaches/therapists** who recommend journaling to clients
- **Professionals** documenting career growth and lessons learned
- **Researchers** interested in personal informatics and quantified self

### 1.4 Core Features (Functional Overview)

| Feature | Description |
|---------|-------------|
| Rich Text Journaling | Full-featured editor with formatting, images, audio attachments |
| AI Mood Detection | Automatic sentiment analysis and mood suggestion |
| Smart Auto-Tagging | AI-generated tags based on content analysis |
| Semantic Search | Find entries by meaning, not just keywords |
| Journal Chat (RAG) | Conversational AI to query personal journal history |
| Text Rewriting | Transform entries with different tones/styles |
| Chapters & Organization | Hierarchical organization of entries |
| Analytics Dashboard | Visualize journaling habits and trends |
| Social Import | Import posts from Instagram/Facebook as entries |

### 1.5 Why AI/NLP is Relevant

NLP is central to Notive because personal journals contain rich, unstructured natural language text that:

1. **Expresses emotions implicitly** - Users rarely write "I am sad"; instead they describe situations that imply sadness
2. **Uses varied vocabulary** - The same concept may be expressed in countless ways
3. **Builds longitudinal context** - Understanding requires connecting entries across time
4. **Benefits from semantic understanding** - Keyword search fails for conceptual queries

The application demonstrates practical NLP applications including:
- Sentiment Analysis
- Named Entity Recognition (implied through topic extraction)
- Text Classification (mood, topics, chapters)
- Semantic Similarity Search (embeddings)
- Retrieval-Augmented Generation (RAG)
- Text Summarization and Rewriting

---

## 2. Overall System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Next.js 14 Frontend (React, TypeScript, TailwindCSS)                   │
│  ├── Web Application (SSR/CSR)                                          │
│  └── Mobile Apps (Capacitor - iOS/Android)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP/REST
┌─────────────────────────────────────────────────────────────────────────┐
│                             BACKEND LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Express.js API Server (TypeScript)                                     │
│  ├── Controllers (Auth, Entry, AI, Analytics, Share, Admin)            │
│  ├── Services (NLP, Tagging, Health Insights, AI)                       │
│  ├── Middleware (Authentication, Authorization)                         │
│  └── Routes (RESTful API endpoints)                                     │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                         │
         ▼                    ▼                         ▼
┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────────┐
│  PostgreSQL │    │ Similarity Svc   │    │    External AI Services     │
│  (Prisma)   │    │ (FastAPI/Python) │    │ ├── OpenAI GPT-3.5-turbo   │
│             │    │ Sentence-BERT    │    │ └── HuggingFace Inference  │
└─────────────┘    └──────────────────┘    └─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL INTEGRATIONS                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Google OAuth (Authentication)    │    Instagram/Facebook (Import)      │
│  Redis (Caching - optional)       │                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Frontend Architecture

**Framework:** Next.js 14 (React 18)

**Key Technologies:**
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first styling
- **Framer Motion** - Animations
- **TipTap** - Rich text editor (ProseMirror-based)
- **Capacitor** - Native mobile builds for iOS/Android

**State Management:**
- React Context API (`AuthContext` for authentication state)
- Custom hooks (`useAnalytics`, `useAuth`)
- Local component state for UI interactions

**Routing:**
- Next.js App Router (file-based routing)
- Key routes: `/dashboard`, `/entry/[id]`, `/chat`, `/insights`, `/profile`

**Frontend Services (Client-Side NLP):**
| Service | Purpose | NLP Technique |
|---------|---------|---------------|
| `ai-content-analyzer.service.ts` | Client-side metadata extraction | Rule-based pattern matching |
| `context.service.ts` | Contextual prompt generation | Time/location awareness |
| `voice-command.service.ts` | Voice input parsing | Rule-based command extraction |
| `rewrite.service.ts` | API client for text rewriting | API wrapper |

### 2.3 Backend Architecture

**Framework:** Express.js (Node.js with TypeScript)

**Architecture Pattern:** MVC-like (Controllers → Services → Data Layer)

```
backend/src/
├── index.ts              # Application entry point
├── config/
│   └── prisma.ts         # Database client configuration
├── controllers/          # Request handlers
│   ├── ai.controller.ts      # AI/NLP endpoints
│   ├── auth.controller.ts    # Authentication
│   ├── entry.controller.ts   # Journal entries CRUD
│   ├── analytics.controller.ts
│   ├── share.controller.ts
│   └── admin.controller.ts
├── services/             # Business logic
│   ├── nlp.service.ts        # Core NLP operations
│   ├── ai.service.ts         # OpenAI wrapper
│   ├── tagging.service.ts    # Auto-tagging
│   ├── health-insights.service.ts
│   └── health-sync.service.ts
├── middleware/
│   ├── auth.middleware.ts    # JWT verification
│   └── admin.middleware.ts   # Role-based access
├── routes/               # Route definitions
└── utils/                # Helper functions (JWT, etc.)
```

### 2.4 Database Layer

**Database:** PostgreSQL with Prisma ORM

**Why PostgreSQL:**
- Robust full-text search capabilities
- JSONB support for flexible data
- Strong relational integrity
- pgvector extension available for embeddings (docker-compose uses `ankane/pgvector`)

### 2.5 External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **OpenAI API** | GPT-3.5-turbo for analysis, chat, rewriting | Direct API calls |
| **HuggingFace Inference** | Alternative LLM (Qwen, GPT-OSS) | `@huggingface/inference` SDK |
| **Sentence Transformers** | Semantic embeddings | Python microservice |
| **Google OAuth** | SSO authentication | `google-auth-library` |
| **Instagram/Facebook** | Social media import | OAuth + Graph API |

### 2.6 Communication Flow

```
User Action → Frontend Component → API Service Call → Express Route
    → Auth Middleware → Controller → Service Layer → Database/External API
    → Response → Frontend State Update → UI Render
```

---

## 3. Detailed Feature Breakdown

### 3.1 User Authentication & Authorization

**Implementation:** JWT-based authentication with refresh token rotation

**Flow:**
1. User registers/logs in via email+password or Google OAuth
2. Server generates:
   - Access Token (short-lived, 15 minutes implied)
   - Refresh Token (7 days, stored in DB)
3. Access token sent in `Authorization: Bearer <token>` header
4. Refresh token stored as HttpOnly cookie + response body

**Security Features:**
- Password hashing with bcrypt (12 rounds)
- Refresh token storage in database for revocation
- Separate token verification functions
- Password reset via secure tokens

**Roles:**
```typescript
enum Role {
  USER      // Standard user
  ADMIN     // Platform administrator
  SUPERADMIN // Full system access
}
```

### 3.2 Core CRUD Features

**Journal Entries:**
- Create with optional auto-tagging
- Rich text content (HTML) + plain text
- Mood selection/detection
- Cover images and audio attachments
- Chapter assignment
- Soft delete (recoverable)

**Chapters:**
- User-defined categories
- Color and icon customization
- Entry grouping

### 3.3 Sharing / Public Access

**ShareLink System:**
- Unique tokens for entries or chapters
- Optional expiration dates
- Public access without authentication
- Separate public viewing route

### 3.4 Analytics / Insights

**Computed Metrics:**
- Total entries, words written
- Current and longest journaling streaks
- Entries per time period
- Mood distribution
- Top tags/topics

**Health-Mood Correlation:**
- Sleep hours vs mood correlation
- Activity level vs mood correlation
- Weekly summaries with patterns

### 3.5 Social Data Import

**Supported Platforms:**
- Instagram (posts with captions)
- Facebook (posts)

**Flow:**
1. OAuth connection saved
2. User requests import candidates
3. User selects posts to import
4. Posts converted to journal entries with source tracking

### 3.6 Admin Features

- User management (view, ban/unban)
- Platform statistics
- User entry viewing (moderation)
- Role management

### 3.7 Background Jobs

**Health Cron Service:**
- Weekly insight generation for connected users
- Configurable via `ENABLE_HEALTH_CRON` environment variable

---

## 4. AI & NLP Components (HIGH PRIORITY)

### 4.1 Complete AI/NLP Feature List

| Feature | Location | NLP Task | Model/Approach |
|---------|----------|----------|----------------|
| Sentiment Analysis | `ai.service.ts`, `nlp.service.ts` | Sentiment Classification | GPT-3.5-turbo |
| Mood Detection | `ai.service.ts` | Text Classification | GPT-3.5-turbo |
| Auto-Tagging | `tagging.service.ts` | Topic Extraction | GPT-3.5-turbo |
| Journal Chat | `nlp.service.ts` | RAG + Response Generation | HuggingFace/OpenAI |
| Semantic Search | `similarity_service.py` | Semantic Similarity | Sentence-BERT |
| Content Analysis | `nlp.service.ts` | Multi-task NLP | GPT-3.5-turbo (JSON mode) |
| Text Rewriting | `nlp.service.ts` | Style Transfer | HuggingFace Qwen / GPT-3.5 |
| Writing Prompts | `ai.service.ts`, `nlp.service.ts` | Prompt Generation | GPT-3.5-turbo |
| Health Insights | `health-insights.service.ts` | Correlation Analysis + NLG | Rule-based + GPT-3.5 |
| Client-Side Analysis | `ai-content-analyzer.service.ts` | Pattern Matching | Rule-based (regex) |

### 4.2 NLP Tasks Used

#### 4.2.1 Sentiment Analysis
**Purpose:** Determine emotional polarity of journal content

**Implementation:**
```typescript
// nlp.service.ts - analyzeContent()
const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{
        role: 'system',
        content: `Analyze text and return JSON with:
            "sentimentScore": number, // -1.0 to 1.0
            "sentimentLabel": "positive" | "negative" | "neutral",
            "emotionalSummary": "string"`
    }]
});
```

**Output:** Score (-1 to 1), label, and human-readable emotional summary

#### 4.2.2 Text Classification (Mood Detection)
**Purpose:** Classify journal entries into mood categories

**Categories:** `happy`, `calm`, `sad`, `anxious`, `frustrated`, `thoughtful`, `motivated`, `tired`

**Two-Tier Approach:**
1. **Client-side (fallback):** Rule-based keyword matching in `ai-content-analyzer.service.ts`
2. **Server-side (primary):** GPT-3.5-turbo classification in `ai.service.ts`

```typescript
// ai.service.ts - analyzeSentiment()
const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{
        role: 'system',
        content: `Respond with ONLY ONE of these moods: 
                  happy, calm, sad, anxious, frustrated, thoughtful, motivated, tired`
    }],
    max_tokens: 10,
    temperature: 0.3
});
```

#### 4.2.3 Topic Extraction / Auto-Tagging
**Purpose:** Automatically generate relevant tags for entries

**Evolution:**
- **Legacy:** Regex-based keyword extraction (deprecated)
- **Current:** GPT-3.5-turbo structured output

```typescript
// tagging.service.ts - suggestTags()
const response = await openai.chat.completions.create({
    messages: [{
        role: 'system',
        content: `Generate 3-5 relevant tags.
                  Rules:
                  1. Tags should be short (1-2 words)
                  2. Respect negation ("I did not study" ≠ "Study")
                  Return ONLY JSON array: ["Work", "Anxiety", "Cafe"]`
    }]
});
```

**Negation Handling:** The prompt explicitly instructs the model to respect negation, addressing a common NLP challenge.

#### 4.2.4 Semantic Similarity Search
**Purpose:** Find conceptually related entries regardless of exact wording

**Implementation:** Dedicated Python microservice using Sentence Transformers

```python
# similarity_service.py
class SimilarityService:
    MODEL_NAME = 'all-MiniLM-L6-v2'  # 384-dim embeddings
    SIMILARITY_THRESHOLD = 0.3
    TOP_K = 5
    
    def find_similar_entries(self, query, entries, top_k, threshold):
        query_embedding = self.model.encode([query])
        entry_embeddings = self.model.encode(entries)
        similarities = np.dot(entry_embeddings, query_embedding.T)
        # Return entries above threshold, sorted by similarity
```

#### 4.2.5 Retrieval-Augmented Generation (RAG)
**Purpose:** Answer questions about journal history using relevant context

**Pipeline:**
1. User asks question
2. Similarity service finds relevant entries
3. Relevant entries injected into LLM context
4. LLM generates grounded response

```typescript
// nlp.service.ts - chatWithRelevantContext()
const relevantEntries = await this.findRelevantEntries(userId, query, entryTexts);
const context = relevantEntries.map(e => `[Entry - ${date}]\n${content}`).join('\n\n');

const response = await hfClient.chatCompletion({
    model: "openai/gpt-oss-120b:fastest",
    messages: [
        { role: "system", content: `You are Notive AI...\n\nRELEVANT ENTRIES:\n${context}` },
        { role: "user", content: query }
    ]
});
```

#### 4.2.6 Text Rewriting / Style Transfer
**Purpose:** Transform text with different tones or purposes

**Styles:**
| Style | Description |
|-------|-------------|
| `clearer` | Improve clarity and conciseness |
| `summary` | Condense to 2-3 sentences |
| `lessons` | Extract key takeaways as bullet points |
| `formal` | Professional tone |
| `casual` | Conversational tone |
| `encouraging` | Positive, supportive tone |

### 4.3 Models, APIs, and Libraries

| Component | Model/Library | Purpose |
|-----------|--------------|---------|
| **OpenAI SDK** | `gpt-3.5-turbo` | Primary LLM for analysis, classification, generation |
| **HuggingFace Inference** | `Qwen/Qwen2.5-72B-Instruct`, `openai/gpt-oss-120b` | Alternative LLM, text rewriting |
| **Sentence Transformers** | `all-MiniLM-L6-v2` | Semantic embeddings (384 dimensions) |
| **FastAPI** | Python web framework | Similarity service API |
| **NumPy** | Numerical operations | Cosine similarity computation |

### 4.4 Why Each NLP Technique Was Chosen

| Technique | Rationale |
|-----------|-----------|
| **GPT-3.5-turbo for classification** | High accuracy on nuanced emotional text; handles context and sarcasm better than rule-based; structured JSON output |
| **Sentence-BERT for similarity** | Captures semantic meaning; "feeling down" matches "sad" without explicit rules; fast inference after embedding |
| **RAG architecture** | Grounds LLM responses in user's actual data; prevents hallucination; provides personalized answers |
| **Separate similarity microservice** | Python ecosystem for ML; PyTorch/Sentence-Transformers maturity; decouples heavy ML inference from Node.js |
| **Client-side rule-based fallback** | Immediate feedback without API latency; works offline; privacy-preserving |

### 4.5 Rule-Based vs ML-Based Logic

| Feature | Type | Justification |
|---------|------|---------------|
| Mood detection (client) | Rule-based | Fast, offline fallback |
| Mood detection (server) | ML-based | Higher accuracy |
| Auto-tagging | ML-based | Semantic understanding needed |
| Semantic search | ML-based | Cannot be done with rules |
| Voice commands | Rule-based | Structured command patterns |
| Tag extraction (client) | Rule-based | Simple pattern matching |
| Health correlation | Hybrid | Statistical rules + NLG for descriptions |

---

## 5. NLP Processing Pipeline (Step-by-Step)

### 5.1 Mood Detection Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Entry Content  │ ──► │  OpenAI API Call │ ──► │  Validate Mood  │
│                 │     │  (10 tokens max) │     │  Against List   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  Return Mood    │
                                                 │  or "thoughtful"│
                                                 └─────────────────┘
```

**Preprocessing:** None (raw text sent to model)  
**Model:** GPT-3.5-turbo with low temperature (0.3) for consistency  
**Postprocessing:** Validate against allowed mood list  

### 5.2 Auto-Tagging Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Title + Content│ ──► │ Structured Prompt│ ──► │  Parse JSON     │
│                 │     │ (GPT-3.5-turbo)  │     │  Response       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Filter by       │
                                                 │ Confidence >0.7 │
                                                 └─────────────────┘
```

**Input:** Combined title + content  
**Prompt Engineering:** Explicit rules about negation, tag length, topic focus  
**Output:** Array of 3-5 string tags  

### 5.3 Semantic Search Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User Query     │ ──► │ TextProcessor    │ ──► │ Sentence-BERT   │
│                 │     │ (Light cleaning) │     │ Encoding        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
┌─────────────────┐     ┌──────────────────┐              ▼
│ Journal Entries │ ──► │ Batch Embedding  │ ◄───────────────────────
│                 │     │                  │
└─────────────────┘     └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Cosine Similarity│
                       │ Matrix Multiply  │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ Filter threshold │
                       │ Sort & Top-K     │
                       └──────────────────┘
```

**Preprocessing:**
```python
def clean_for_embedding(self, text: str) -> str:
    text = ' '.join(text.split())  # Normalize whitespace
    text = re.sub(r'[^\w\s]{3,}', ' ', text)  # Remove special char sequences
    return text.strip()
```

**Embedding:** 384-dimensional vectors from `all-MiniLM-L6-v2`  
**Similarity:** Cosine similarity via normalized dot product  
**Thresholding:** Default 0.3 (higher than TF-IDF due to semantic nature)  

### 5.4 RAG Chat Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User Question  │ ──► │ Similarity Svc   │ ──► │ Top 5 Entries   │
│                 │     │ (HTTP POST)      │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Format as       │
                                                 │ Context Block   │
                                                 └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ System Prompt + │
                                                 │ Context + Query │
                                                 └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ HuggingFace or  │
                                                 │ OpenAI LLM      │
                                                 └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Generated       │
                                                 │ Response        │
                                                 └─────────────────┘
```

**Retrieval:** Semantic similarity via Python microservice  
**Context Construction:**
```typescript
const context = entries.map((e, i) => {
    const date = new Date(e.createdAt).toLocaleDateString();
    return `[Entry ${i + 1} - ${date}]${e.title ? ` Title: ${e.title}` : ''}\n${e.content}`;
}).join('\n\n---\n\n');
```

**System Prompt:** Instructs model to be supportive, reference specific entries, admit when information isn't available  

### 5.5 Content Analysis Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Entry Content  │ ──► │ Calculate Stats  │ ──► │ OpenAI Analysis │
│                 │     │ (words, time)    │     │ (JSON output)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │ Parse & Return  │
                                                 │ AnalysisResult  │
                                                 └─────────────────┘
```

**Output Structure:**
```typescript
interface AnalysisResult {
    sentiment: { score: number; label: string; summary: string };
    entities: Array<{ text: string; type: string }>;
    topics: string[];
    suggestedMood: string;
    wordCount: number;
    readingTime: number;
}
```

### 5.6 Storage of NLP Outputs

| Output | Storage Location | Field |
|--------|------------------|-------|
| Detected mood | `Entry.mood` | `String?` |
| Tags | `Entry.tags` | `String[]` |
| Skills/Topics | `Entry.skills` | `String[]` |
| Lessons | `Entry.lessons` | `String[]` |
| Reflection | `Entry.reflection` | `Text?` |
| Health Insights | `HealthInsight` | Separate table |

---

## 6. Knowledge Base & Retrieval Design

### 6.1 Knowledge Base Definition

The user's **journal entries** serve as the personal knowledge base. Each entry contains:
- Unstructured text content (primary knowledge)
- Metadata (date, mood, tags)
- Relationships (chapters, user)

### 6.2 Indexing & Querying Approach

**Current Implementation:** Real-time embedding computation

```
User Query → Fetch all user entries → Embed all → Compare → Return top K
```

**No persistent vector storage** - Embeddings computed on-demand for each query.

### 6.3 Retrieval Architecture Classification

Notive implements **RAG-lite** (Retrieval-Augmented Generation - Lightweight):

| Aspect | Full RAG | Notive's RAG-lite |
|--------|----------|-------------------|
| Vector DB | Persistent (Pinecone, Weaviate) | None |
| Embedding Storage | Pre-computed | On-demand |
| Chunking Strategy | Sophisticated | Whole entries |
| Re-ranking | Multiple stages | Single similarity pass |
| Scalability | High | Limited by entry count |

### 6.4 Relevance Calculation

**Algorithm:** Cosine similarity on normalized embeddings

```python
# Embeddings are pre-normalized during encoding
embeddings = self.model.encode(texts, normalize_embeddings=True)

# Similarity = simple dot product (faster than full cosine formula)
similarities = np.dot(entry_embeddings, query_embedding)
```

**Threshold:** 0.3 (entries below this are filtered out)  
**Selection:** Top 5 most similar entries

### 6.5 Limitations of Retrieval Approach

1. **Scalability:** Embedding all entries on every query is O(n) - becomes slow with thousands of entries
2. **No chunking:** Long entries treated as single units, may miss specific paragraphs
3. **No persistent index:** Repeated queries re-compute embeddings unnecessarily
4. **Cold start:** First query loads the model (several seconds)
5. **Single representation:** Each entry has one embedding; multi-aspect retrieval not supported

---

## 7. API Design & Routes

### 7.1 Route Groups Overview

| Route Group | Base Path | Auth Required | Purpose |
|-------------|-----------|---------------|---------|
| Auth | `/api/v1/auth` | No (mostly) | Registration, login, token refresh |
| Entries | `/api/v1/entries` | Yes | CRUD operations on journal entries |
| AI | `/api/v1/ai` | Yes | NLP features (chat, analyze, rewrite) |
| Chapters | `/api/v1/chapters` | Yes | Chapter management |
| Share | `/api/v1/share` | Partial | Create/access share links |
| Analytics | `/api/v1/analytics` | Yes | User statistics |
| User | `/api/v1/user` | Yes | Profile management |
| Admin | `/api/v1/admin` | Yes (Admin+) | Platform administration |
| Social | `/api/v1/social` | Yes | Google OAuth for Fit |
| Import | `/api/v1/import` | Yes | Social media import |
| Files | `/api/v1/files` | Yes | File uploads |
| Health | `/api/v1/health` | Yes | Health data endpoints |

### 7.2 AI/NLP Route Details

```typescript
// routes/ai.routes.ts
router.post('/chat', authMiddleware, chatWithJournal);      // RAG chat
router.post('/analyze/:entryId?', authMiddleware, analyzeEntry);  // Content analysis
router.get('/statement', authMiddleware, generatePersonalStatement);  // Skills summary
router.post('/rewrite', authMiddleware, rewriteText);       // Style transfer
```

### 7.3 Request/Response Flow Example

**POST /api/v1/ai/chat**

```
Request:
{
    "query": "When was I last happy?"
}

Headers:
Authorization: Bearer <access_token>

Processing:
1. authMiddleware verifies JWT
2. chatWithJournal controller invoked
3. Fetch user's entries from PostgreSQL
4. Call similarity service (POST /similarity)
5. Build context from relevant entries
6. Call HuggingFace/OpenAI API
7. Return response

Response:
{
    "response": "Based on your entries, you mentioned feeling 
                 particularly happy on January 15th when you..."
}
```

### 7.4 Routes Invoking AI/NLP Logic

| Route | NLP Feature |
|-------|-------------|
| `POST /ai/chat` | RAG (similarity + generation) |
| `POST /ai/analyze/:entryId?` | Sentiment, entities, topics |
| `POST /ai/rewrite` | Text rewriting |
| `GET /ai/statement` | Skills aggregation |
| `POST /entries` | Auto-tagging (if enabled) |
| `GET /health/insights` | Health-mood correlation |

---

## 8. Database Schema & Data Modeling

### 8.1 Core Database Tables

```
┌──────────────────────────────────────────────────────────────┐
│                         User                                  │
├──────────────────────────────────────────────────────────────┤
│ id: String (cuid)          │ Primary key                     │
│ email: String              │ Unique                          │
│ password: String?          │ Nullable for SSO users          │
│ name: String?              │                                 │
│ role: Role                 │ USER | ADMIN | SUPERADMIN       │
│ googleId: String?          │ For Google OAuth                │
│ isBanned: Boolean          │ Account status                  │
└──────────────────────────────────────────────────────────────┘
                               │
                               │ 1:N
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                        Entry                                  │
├──────────────────────────────────────────────────────────────┤
│ id: String (cuid)          │ Primary key                     │
│ title: String?             │ Optional title                  │
│ content: Text              │ Plain text content              │
│ contentHtml: Text?         │ Rich text (HTML)                │
│ mood: String?              │ *** NLP OUTPUT ***              │
│ tags: String[]             │ *** NLP OUTPUT ***              │
│ skills: String[]           │ *** NLP OUTPUT ***              │
│ lessons: String[]          │ *** NLP OUTPUT ***              │
│ reflection: Text?          │ *** NLP OUTPUT ***              │
│ source: EntrySource        │ NOTIVE | FACEBOOK | INSTAGRAM   │
│ userId: String             │ Foreign key                     │
│ chapterId: String?         │ Foreign key                     │
│ deletedAt: DateTime?       │ Soft delete                     │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Entity Relationships

```
User ─────┬───── 1:N ─────── Entry
          │
          ├───── 1:N ─────── Chapter ────── 1:N ───── Entry
          │
          ├───── 1:N ─────── RefreshToken
          │
          ├───── 1:1 ─────── UserProfile
          │
          ├───── 1:N ─────── SocialConnection
          │
          ├───── 1:1 ─────── GoogleFitConnection
          │
          ├───── 1:N ─────── HealthContext
          │
          └───── 1:N ─────── HealthInsight

Entry ────────── 1:N ─────── ShareLink

Chapter ──────── 1:N ─────── ShareLink
```

### 8.3 Fields Relevant to NLP

| Table | Field | NLP Purpose |
|-------|-------|-------------|
| Entry | `content` | Primary input for all NLP |
| Entry | `mood` | Output of mood detection |
| Entry | `tags` | Output of auto-tagging |
| Entry | `skills` | Topics mapped from analysis |
| Entry | `lessons` | Extracted takeaways |
| Entry | `reflection` | AI-generated reflection |
| HealthContext | `sleepQuality` | Input for correlation analysis |
| HealthInsight | `description` | NLG output |
| HealthInsight | `data` | JSON structured insights |

### 8.4 AI-Generated Data Storage

```prisma
model HealthInsight {
  id          String   @id @default(cuid())
  userId      String
  type        String   // 'sleep_mood', 'activity_mood', 'weekly_summary'
  title       String   // AI-generated title
  description String   @db.Text  // AI-generated description
  data        Json?    // Structured data (charts, stats)
  period      String   // 'day', 'week', 'month'
  generatedAt DateTime @default(now())
}
```

---

## 9. Security & Privacy Considerations

### 9.1 Authentication Mechanism

- **JWT Access Tokens:** Short-lived, stateless verification
- **Refresh Tokens:** Database-stored for revocation capability
- **Dual delivery:** Cookies (HttpOnly) + response body for mobile clients

### 9.2 Token Handling

```typescript
// Access token generation
const accessToken = jwt.sign(
    { userId, email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
);

// Refresh token with DB storage
await prisma.refreshToken.create({
    data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(), // 7 days
    },
});
```

### 9.3 Data Access Control

- **User isolation:** All queries filter by `userId`
- **Soft deletes:** `deletedAt` prevents accidental data loss
- **Role-based admin access:** `admin.middleware.ts` checks `role`
- **Share tokens:** Separate from auth, cryptographically random

### 9.4 Sensitive User Text Protection

| Concern | Mitigation |
|---------|------------|
| Text sent to OpenAI/HuggingFace | Users implicitly consent by using AI features |
| Text stored in DB | Standard PostgreSQL security; no encryption at rest by default |
| Text in transit | HTTPS required in production |
| Admin access | Admins can view entries (moderation) - logged |

### 9.5 AI-Specific Privacy Concerns

1. **Third-party API exposure:** Journal content sent to OpenAI/HuggingFace
   - *Mitigation:* These providers have data processing agreements
   - *Future:* Could add option to disable AI features

2. **Embedding service:** Content processed by Python service
   - *Mitigation:* Self-hosted within same infrastructure (Docker)

3. **Social import:** Instagram/Facebook content imported
   - *Mitigation:* User-initiated; marked with source

---

## 10. Performance & Scalability

### 10.1 Optimization Techniques in Code

**Batch Processing:**
```python
# Similarity service embeds all texts at once
embeddings = self.model.encode(texts, convert_to_numpy=True, 
                               normalize_embeddings=True)
```

**Lazy Model Loading:**
```python
@property
def model(self) -> SentenceTransformer:
    if self._model is None:
        self._model = SentenceTransformer(self.model_name)
    return self._model
```

**Database Query Optimization:**
```typescript
// Parallel queries with Promise.all
const [entries, total] = await Promise.all([
    prisma.entry.findMany({...}),
    prisma.entry.count({...}),
]);
```

**Selective Field Loading:**
```typescript
select: {
    content: true,
    createdAt: true,
    title: true
    // Excludes large fields like contentHtml when not needed
}
```

### 10.2 Potential Bottlenecks

| Bottleneck | Location | Impact |
|------------|----------|--------|
| Similarity service cold start | First query | 2-5 second delay |
| Embedding all entries | Large journals | O(n) per query |
| External API calls | OpenAI/HuggingFace | Network latency |
| No caching | Repeated queries | Redundant computation |
| Single-threaded Node.js | CPU-intensive tasks | Blocking |

### 10.3 AI Inference Performance

**Similarity Service:**
- Model: `all-MiniLM-L6-v2` (optimized for speed)
- Embedding dimension: 384 (smaller = faster)
- Batch encoding: Vectorized operations

**LLM Calls:**
- `max_tokens` limited (10-500 depending on task)
- Low `temperature` for classification (faster sampling)
- Fallback chain: HuggingFace → OpenAI

---

## 11. Limitations & Technical Challenges

### 11.1 Current System Limitations

| Limitation | Description | Impact |
|------------|-------------|--------|
| No vector database | Embeddings computed on-demand | Slow for large journals |
| Single embedding model | No domain adaptation | May miss journal-specific semantics |
| No fine-tuning | Using general-purpose models | Lower accuracy than specialized models |
| API dependency | Requires OpenAI/HuggingFace | Fails without internet |
| No offline mode | All NLP requires backend | Mobile app limited offline |
| English only | Models trained on English | Non-English users disadvantaged |

### 11.2 NLP Accuracy Issues

1. **Mood detection nuance:** Sarcasm, irony, and complex emotions may be misclassified
2. **Tag relevance:** AI may suggest tags based on surface mentions, not core themes
3. **Similarity threshold:** Fixed 0.3 may be too high or too low for different query types
4. **Context window limits:** Long entries may be truncated for LLM processing
5. **RAG hallucination:** Model may still generate content not in retrieved entries

### 11.3 Scalability Constraints

- **Entry limit:** Performance degrades with 1000+ entries per user
- **Concurrent users:** Similarity service single-instance
- **API rate limits:** OpenAI/HuggingFace throttling under load

### 11.4 Incomplete or Mocked Features

| Feature | Status | Notes |
|---------|--------|-------|
| Lessons extraction | Partially mocked | Placeholder responses |
| Reflection questions | Mocked | Hardcoded questions |
| Voice transcription | Client-side only | No backend speech-to-text |
| Gamification | Placeholder | XP system incomplete |

---

## 12. Future Improvements

### 12.1 NLP Improvements

**Models:**
- Fine-tune Sentence-BERT on journal-specific data
- Add domain-adapted models for emotion detection (e.g., GoEmotions)
- Implement local LLM option (Llama, Mistral) for privacy

**Pipelines:**
- Add named entity recognition for people/places
- Implement topic modeling (LDA, BERTopic) for trend analysis
- Add multi-document summarization for weekly/monthly reviews
- Implement abstractive summarization for entry summaries

**Evaluation:**
- Add sentiment analysis ground truth dataset
- Implement A/B testing for tag suggestions
- Track user acceptance rate for auto-tags

### 12.2 System Architecture Improvements

**Vector Database Integration:**
```
┌─────────────────┐     ┌──────────────────┐
│ Entry Creation  │ ──► │ Embed & Store in │
│                 │     │ Pinecone/Weaviate│
└─────────────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ Query Time      │ ──► │ Vector Lookup    │
│                 │     │ (O(log n))       │
└─────────────────┘     └──────────────────┘
```

**Caching Layer:**
- Redis for API response caching
- Embedding cache for repeated entries
- LLM response caching for common queries

**Microservices:**
- Split NLP service from main backend
- Horizontal scaling for embedding service
- Queue-based async processing for heavy tasks

### 12.3 Privacy-Preserving AI Enhancements

1. **Local embedding:** Run Sentence-BERT in browser via ONNX
2. **On-device LLM:** Small quantized models for basic tasks
3. **Federated learning:** Improve models without centralizing data
4. **Differential privacy:** Add noise to exported analytics
5. **Opt-out AI:** Allow users to disable all cloud AI processing

---

## 13. Academic Relevance

### 13.1 NLP Concepts Demonstrated

| Concept | Implementation | Course Relevance |
|---------|----------------|------------------|
| **Sentiment Analysis** | GPT-3.5 classification | Core NLP task |
| **Text Classification** | Mood categorization | Supervised learning application |
| **Semantic Similarity** | Sentence-BERT embeddings | Dense retrieval, vector semantics |
| **Information Retrieval** | RAG architecture | IR fundamentals + neural methods |
| **Text Generation** | LLM-based responses | Language modeling, seq2seq |
| **Style Transfer** | Text rewriting | Controlled generation |
| **Named Entity Recognition** | Entity extraction | Sequence labeling |
| **Prompt Engineering** | Structured prompts | Modern NLP technique |
| **Embeddings** | 384-dim dense vectors | Distributional semantics |

### 13.2 Software Engineering Concepts Applied

| Concept | Implementation |
|---------|----------------|
| **Microservices** | Separate similarity service |
| **RESTful API design** | Express.js routes |
| **Database design** | Prisma schema, relations |
| **Authentication** | JWT, OAuth 2.0 |
| **Containerization** | Docker, docker-compose |
| **Full-stack development** | Next.js + Express + Python |
| **Type safety** | TypeScript throughout |
| **ORM patterns** | Prisma client |

### 13.3 Why This Project is Suitable for an NLP Course

1. **Practical application:** Demonstrates NLP solving real user problems
2. **Multiple techniques:** Covers classification, similarity, generation, retrieval
3. **Modern approaches:** Uses transformers, embeddings, LLMs
4. **System integration:** Shows how NLP fits into full applications
5. **Trade-off decisions:** Documents why specific approaches were chosen
6. **Limitations awareness:** Acknowledges accuracy and scalability constraints
7. **Ethical considerations:** Addresses privacy in AI-powered personal data systems
8. **Reproducible:** Open architecture, standard tools, documented setup

---

## Appendix A: Technology Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend Framework | Next.js | 14.1.0 |
| Frontend Language | TypeScript | 5.x |
| UI Styling | TailwindCSS | 3.3.0 |
| Rich Text Editor | TipTap | 3.12.1 |
| Mobile | Capacitor | 7.4.4 |
| Backend Framework | Express.js | 4.18.2 |
| Backend Language | TypeScript | 5.3.3 |
| Database | PostgreSQL | Latest |
| ORM | Prisma | 5.22.0 |
| ML Framework | Sentence Transformers | 2.2.2 |
| ML Runtime | PyTorch | 2.0+ |
| ML API Framework | FastAPI | 0.109.0 |
| LLM SDK | OpenAI | 6.10.0 |
| LLM SDK | HuggingFace Inference | 4.13.9 |

---

## Appendix B: Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/notive_db

# Authentication
JWT_ACCESS_SECRET=<random-string>
JWT_REFRESH_SECRET=<random-string>

# AI Services
OPENAI_API_KEY=<openai-key>
HF_TOKEN=<huggingface-token>
SIMILARITY_SERVICE_URL=http://localhost:8001

# OAuth
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>

# Application
CLIENT_URL=http://localhost:3000
PORT=8000
ENABLE_HEALTH_CRON=true
```

---

## Appendix C: API Endpoint Reference

### AI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/chat` | RAG-based journal chat |
| POST | `/api/v1/ai/analyze/:entryId?` | Content analysis |
| GET | `/api/v1/ai/statement` | Personal statement generation |
| POST | `/api/v1/ai/rewrite` | Text style transfer |

### Similarity Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| POST | `/similarity` | Find similar entries |

---

*Document generated from codebase analysis - January 2026*
