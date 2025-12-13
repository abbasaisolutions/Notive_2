# Notive

A modern, AI-powered journaling application with voice input, mood tracking, and intelligent insights.

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

1. **Node.js** (v18 or later): [Download here](https://nodejs.org/)
2. **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/)
3. **Git**: [Download here](https://git-scm.com/downloads)

## Project Structure

- `frontend/`: Next.js 14 application (React, Tailwind CSS, TypeScript)
- `backend/`: Node.js Express application (TypeScript, Prisma)
- `docker-compose.yml`: Database configuration (PostgreSQL)

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
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:8000/api/v1)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Google OAuth client ID (optional)

### 4. Start the Database

Make sure Docker Desktop is running, then:

```bash
docker-compose up -d
```

This starts a PostgreSQL database on port 5432.

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

### 7. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

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

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions for various platforms including:
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
- **AI Integration**: OpenAI API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on GitHub.
