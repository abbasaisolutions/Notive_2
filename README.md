# Notive

A modern, local-first journaling application with voice input, mood tracking, retrieval-powered memory search, and optional AI guidance.

Notive is developed and owned by AbbasAI Solutions, LLC.

## Features

- 📝 **Rich Text Editor** with voice input support
- 🎭 **Mood Tracking** with AI-powered analysis
- 📚 **Chapter Organization** for categorizing entries
- 🔐 **Secure Authentication** with Google OAuth support
- 📊 **Analytics Dashboard** to track your journaling habits
- 🎯 **Gamification** with XP and achievements
- 📱 **Mobile Support** via Capacitor (iOS & Android)
- 🌐 **Social Sharing** for selected entries

## Prerequisites

To run this project, you need to install the following tools on your machine:

1. **Node.js** (v22.12 or later, v22 LTS recommended): [Download here](https://nodejs.org/)
2. **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/)
3. **Git**: [Download here](https://git-scm.com/downloads)

## Project Structure

- `frontend/`: Next.js 14 application (React, Tailwind CSS, TypeScript)
- `backend/`: Node.js Express application (TypeScript, Prisma)
- `similarity-service/`: Local retrieval and reranking microservice
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
- `NEXT_PUBLIC_APP_URL`: Public frontend URL (production example: `https://notive.abbasaisolutions.com`)
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:8000/api/v1)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth client ID (optional)

### 4. Start the Database

Make sure Docker Desktop is running, then:

```bash
docker-compose up -d
```

This starts a PostgreSQL database on port 5432.
This also starts MongoDB, Redis, the deterministic NLP service, and the local similarity service.
The similarity service now defaults to the validated local CPU mix: ONNX embeddings plus a torch reranker.

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

## Voice Input

The voice input feature uses the Web Speech API and is supported in:
- ✅ Chrome/Chromium browsers
- ✅ Microsoft Edge
- ❌ Firefox (not supported)
- ⚠️ Safari (limited support)

To use voice input:
1. Create a new journal entry
2. Click the microphone icon in the editor toolbar
3. Allow microphone access when prompted
4. Start speaking - your words will be transcribed in real-time

## Google OAuth Setup (Optional)

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
- generates a fresh Android release number for every run
- builds a signed `.aab`
- uploads the bundle as a GitHub Actions artifact
- uploads it to the Google Play `internal` track when `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is configured

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
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **File Upload**: Multer
- **Local Retrieval**: Sentence Transformers + pgvector
- **Optional Generation**: OpenAI-compatible chat provider

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
