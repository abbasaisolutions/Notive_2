# Notive

A private diary platform that helps people capture real moments, keep meaningful memories, understand what those moments hold, and turn them into lessons, skills, patterns, and reusable stories.

Notive is developed and owned by AbbasAI Solutions, LLC.

## Current Status

- Product story: `Capture -> Keep -> Understand -> Use`
- Core user surfaces live today: `Dashboard`, `Memories`, `AskNotive`, `Stories`, and `Bring In`
- `AskNotive` currently offers `memory`, `patterns`, `lessons`, and `stories` lenses
- The dashboard currently surfaces the latest capture, extracted lesson/skill/theme signals, resurfaced memories, story progress, and `On This Day` recall
- New account creation currently uses Google Sign-In; legacy email/password login still exists for older accounts and password recovery flows
- Reminders, push notifications, weekly digests, and re-engagement emails are part of the product and honor notification preferences

## Features

- 📝 **Private Diary Capture** with rich text, quick entry, and reusable prompts
- 🎙️ **Voice Capture & Transcription** powered by Faster Whisper with browser fallback support
- 🎭 **Mood, Entity, and Insight Extraction** via deterministic NLP and structured analysis
- 🔍 **Semantic Memory Search & Resurfacing** with local embeddings, reranking, and related-memory recall
- 🧠 **AskNotive** for memory understanding, lesson extraction, pattern review, and story-building help
- 📅 **Timeline, Calendar, and Memory Browsing** across saved entries
- 📂 **Stories Workspace** for turning diary material into reusable outputs for school, work, and life
- 📥 **Bring In** for social imports and archive-based memory intake
- 📊 **Diary Dashboard** with latest-capture signals, resurfaced memories, story progress, and `On This Day`
- 🔔 **Reminders, Push, Weekly Digests, and Re-engagement** via Firebase Cloud Messaging and email
- 📚 **Chapter Organization** for grouping entries and story threads
- 🔐 **Authentication** with Google Sign-In for new users plus legacy email/password support for existing accounts
- 📱 **Mobile Support** via Capacitor (iOS & Android)

## Prerequisites

To run this project, you need to install the following tools on your machine:

1. **Node.js** (v22.12 or later, v22 LTS recommended): [Download here](https://nodejs.org/)
2. **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/)
3. **Git**: [Download here](https://git-scm.com/downloads)

## Project Structure

- `frontend/`: Next.js 14 application (React, Tailwind CSS, TypeScript)
- `backend/`: Node.js Express application (TypeScript, Prisma)
- `backend/nlp_service/`: Deterministic NLP microservice (Python, spaCy)
- `similarity-service/`: Local embedding and reranking microservice
- `stt-service/`: Speech-to-text microservice (Python, Faster Whisper)
- `docker-compose.yml`: Local infrastructure and ML services

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/abbasaisolutions/Notive_2.git
cd Notive_2
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
cd ..
```

The backend workspace is pinned to `npm@10.9.3` in [backend/package.json](./backend/package.json) because Railway installs it with `npm ci`. If you ever refresh [backend/package-lock.json](./backend/package-lock.json), do that from `backend/` with npm 10 so local lockfile updates stay compatible with production deploys.

### 3. Set Up Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Edit .env with your configuration
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET`: Random secure strings
- `CLIENT_URL`: Public frontend URL used by backend auth and email links
- `NEXT_PUBLIC_APP_URL`: Public frontend URL (production example: `https://notive.abbasaisolutions.com`)
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:8000/api/v1)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth client ID (required if you want Google sign-in/sign-up locally; new public signup currently uses Google Sign-In)

Feature-specific environment variables:
- `FIREBASE_SERVICE_ACCOUNT`: Firebase service-account JSON string (required for push notifications in production; falls back to console logging in development)
- `RESEND_API_KEY` and `EMAIL_FROM`: Required for password reset, welcome email, weekly digest, and re-engagement email delivery

### 4. Start the Database

Make sure Docker Desktop is running, then:

```bash
docker-compose up -d
```

This starts six services:

| Service            | Port  | Purpose                                       |
|--------------------|-------|-----------------------------------------------|
| PostgreSQL         | 5432  | Primary relational database (pgvector)        |
| MongoDB            | 27017 | Document store for analytics and logs         |
| Redis              | 6379  | Caching and rate limiting                     |
| NLP service        | 8001  | Sentiment, entity, and mood detection (spaCy) |
| Similarity service | 8002  | Local embeddings and reranking (ONNX + torch) |
| STT service        | 8003  | Speech-to-text transcription (Faster Whisper) |

The similarity service defaults to the validated local CPU mix: ONNX embeddings plus a torch reranker.

### 5. Run Database Migrations

```bash
cd backend
npx prisma migrate dev
cd ..
```

### 6. Start the Application

**Option A: Using the provided batch script (Windows)**
```bash
start-app.bat
```

**Option B: Manual start**

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

### Local Retrieval Rollout

The recommended local-first setup is already reflected in [backend/.env.example](./backend/.env.example):

- `USE_EMBEDDINGS="true"`
- `EMBEDDING_PROVIDER="local_service"`
- `EMBEDDING_SERVICE_URL="http://localhost:8002"`
- `SIMILARITY_SERVICE_URL="http://localhost:8002"`
- `LLM_PROVIDER="disabled"`

After the services are running, backfill the stored entry embeddings:

```bash
cd backend
npm run retrieval:doctor
npm run backfill:embeddings
```

If you switch embedding models later, run:

```bash
npm run backfill:embeddings:force
```

To compare retrieval models locally:

```powershell
cd ..\similarity-service
.\run-retrieval-eval.ps1
```

### 7. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

## Production Smoke Checks

Once the frontend is built and the backend is running, you can run a lightweight smoke pass from the frontend workspace:

```bash
cd frontend
npm run smoke:test
```

By default, the smoke runner checks the public app routes and backend root health on:

- `SMOKE_FRONTEND_URL=http://127.0.0.1:3000`
- `SMOKE_API_URL=http://127.0.0.1:8000/api/v1`

To include authenticated staging checks, provide a real staging account:

```powershell
$env:SMOKE_FRONTEND_URL="https://your-frontend.example.com"
$env:SMOKE_API_URL="https://your-api.example.com/api/v1"
$env:SMOKE_EMAIL="staging-user@example.com"
$env:SMOKE_PASSWORD="your-staging-password"
npm run smoke:test
```

When the auth variables are not set, the protected API checks are skipped automatically.

## Voice Capture and Transcription

Notive currently supports two voice paths:

- **Backend transcription** through the local `stt-service` (Faster Whisper) for recorded audio
- **Browser fallback / preview transcription** through the Web Speech API where supported

Browser fallback support:
- ✅ Chrome / Chromium
- ✅ Microsoft Edge
- ❌ Firefox
- ⚠️ Safari (limited)

To use voice capture:
1. Create a new journal entry
2. Click the microphone icon in the editor toolbar
3. Allow microphone access when prompted
4. Record or speak into the capture flow
5. Notive will transcribe through the backend service, with browser fallback where available

## Google OAuth Setup (Required for New Account Creation)

New public account creation currently goes through Google Sign-In. Existing legacy accounts can still sign in with email/password and use forgot/reset password.

To enable Google Sign-In:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000` (development)
   - Your production URL (when deployed)
6. Copy the Client ID and add it to your `.env` files

## Development

### Database Management

```bash
# View database in Prisma Studio
cd backend
npx prisma studio

# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Building for Production

```bash
# Build frontend
cd frontend
npm run build

# Build backend
cd ../backend
npm run build
```

### Android Debug Build

On Windows, the frontend workspace now includes a repeatable Android prep/build flow:

```powershell
cd frontend
npm run android:prepare
npm run android:build:debug
```

`android:prepare` clears stale exported assets, rebuilds the static web app, syncs Capacitor, and verifies that the Android bundle only includes the current `manifest.webmanifest` path. `android:build:debug` then builds the APK with a supported Java runtime, preferring Android Studio's bundled Java 21 if your machine-wide `java.exe` is too new.

### Android Release Bundle

To prepare a signed Google Play bundle, copy [key.properties.example](./frontend/android/key.properties.example) to `frontend/android/key.properties`, point `storeFile` at your upload keystore, and fill in the signing passwords and alias. You can also provide the same values through the environment variables `PLAY_UPLOAD_STORE_FILE`, `PLAY_UPLOAD_STORE_PASSWORD`, `PLAY_UPLOAD_KEY_ALIAS`, and `PLAY_UPLOAD_KEY_PASSWORD`.

Then build the Play-ready bundle:

```powershell
cd frontend
$env:NOTIVE_VERSION_CODE="2"
$env:NOTIVE_VERSION_NAME="1.0.1"
npm run android:build:release
```

The release script keeps using Android Studio's bundled Java runtime when available and produces a signed `.aab` through `bundleRelease`.

### Automated Android Releases

Pushes to `main` now trigger [`.github/workflows/android-release.yml`](./.github/workflows/android-release.yml). That workflow:

- rebuilds the frontend and syncs Capacitor so the latest web changes are included in the Android bundle
- uses the Android release number checked into `frontend/android/gradle.properties`
- builds a signed `.aab`
- uploads the bundle as a GitHub Actions artifact
- uploads it to the Google Play `internal` track when `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is configured

The current checked-in Android release is `1117 (1.1.17)`. If you want the next Play upload to use a new version, bump `frontend/android/gradle.properties` first or run one of:

- `npm run android:version:patch`
- `npm run android:version:minor`
- `npm run android:version:major`

Set these GitHub repository secrets before relying on the workflow:

- `PLAY_UPLOAD_KEYSTORE_BASE64`
- `PLAY_UPLOAD_STORE_PASSWORD`
- `PLAY_UPLOAD_KEY_ALIAS`
- `PLAY_UPLOAD_KEY_PASSWORD`

Set these repository variables for a production-ready Android build:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID` if you use a separate web client ID alias
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_NATIVE_API_URL`
- `NEXT_PUBLIC_APP_URL`

Optional:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` to auto-publish to Google Play internal testing

Important: a Git push alone does not update apps already installed on user devices. That happens only after the new bundle is distributed through Google Play, or through a separate live-update system for web assets.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions for various platforms including:
- Vercel (Frontend) + Vercel (API)
- Vercel (Frontend) + Railway (Backend)
- Docker
- Traditional VPS

## Troubleshooting

### "Failed to fetch" error on login
- Ensure the backend is running on port 8000
- Check that `NEXT_PUBLIC_API_URL` in frontend/.env matches your backend URL
- Verify CORS is configured correctly in backend

### Database connection errors
- Make sure Docker Desktop is running
- Check that PostgreSQL container is running: `docker ps`
- Verify `DATABASE_URL` in backend/.env is correct

### Voice input not working
- Check browser compatibility (Chrome/Edge recommended)
- Ensure microphone permissions are granted
- Try using HTTPS (required by some browsers)

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (React 18)
- **Styling**: Tailwind CSS
- **Editor**: Tiptap (ProseMirror)
- **Animations**: Framer Motion
- **Mobile**: Capacitor 7
- **OAuth**: @react-oauth/google

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript with Zod validation
- **Database**: PostgreSQL with Prisma ORM + MongoDB for analytics
- **Cache**: Redis
- **Authentication**: JWT with refresh tokens
- **Push Notifications**: Firebase Cloud Messaging (firebase-admin)
- **File Upload**: Multer
- **Monitoring**: Sentry
- **Local Retrieval**: Sentence Transformers + pgvector
- **Optional Generation**: OpenAI-compatible chat provider

### Microservices
- **NLP Service**: Python / spaCy -- sentiment analysis, entity extraction, mood detection (port 8001)
- **Similarity Service**: Python / Sentence Transformers -- ONNX embeddings + torch reranker (port 8002)
- **STT Service**: Python / Faster Whisper -- speech-to-text transcription (port 8003)

## Contributing

This repository is proprietary. Please contact AbbasAI Solutions, LLC before contributing,
redistributing the codebase, or using it outside an authorized engagement.

## License

Copyright (c) 2026 AbbasAI Solutions, LLC. All rights reserved.

This repository is proprietary and is not licensed for public use, copying,
modification, or redistribution except with prior written permission from AbbasAI
Solutions, LLC. See the [LICENSE](./LICENSE) file for details.

## Support

For issues and questions, please open an issue on GitHub.
