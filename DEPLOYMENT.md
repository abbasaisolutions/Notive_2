# Notive Deployment Guide

This guide covers deploying the Notive application to various platforms.

## Prerequisites

Before deploying, ensure you have:

1. A PostgreSQL database (can use managed services like Supabase, Neon, or Railway)
2. Google OAuth credentials (if using Google Sign-In)
3. Environment variables configured

## Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# JWT Secrets (use strong random strings!)
JWT_ACCESS_SECRET="your_secure_random_string_here"
JWT_REFRESH_SECRET="your_secure_random_string_here"

# Token Expiry
ACCESS_TOKEN_EXPIRY="15m"
REFRESH_TOKEN_EXPIRY="7d"

# Server
PORT=8000
NODE_ENV=production

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
```

### Frontend (.env.local or .env.production)

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api/v1
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## Deployment Options

### Option 1: Vercel (Frontend) + Vercel (API)

This works well for the Next.js frontend and the main Express API when you split them into two Vercel projects:

- `notive.abbasaisolutions.com` -> frontend project rooted at `frontend`
- `api.abbasaisolutions.com` -> backend project rooted at `backend`

Important: the optional Python NLP service and similarity-service are not Vercel Functions. For a Vercel-only launch, either disable those integrations or point the backend at separately hosted services.

#### Deploy Frontend to Vercel

1. Create a new Vercel project from this repo
2. Set **Root Directory** to `frontend`
3. Leave the framework preset as **Next.js**
4. Set environment variables:
   - `NEXT_PUBLIC_APP_URL=https://notive.abbasaisolutions.com`
   - `NEXT_PUBLIC_API_URL=https://api.abbasaisolutions.com/api/v1`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...` (if using Google Sign-In)
   - `NEXT_PUBLIC_SUPPORT_EMAIL=...` (optional)
5. Add the production domain `notive.abbasaisolutions.com`
6. In IONOS, point `notive.abbasaisolutions.com` to the Vercel DNS target shown in the Vercel Domains tab

Troubleshooting: if the build fails with `No Next.js version detected`, confirm the Vercel project's Root Directory is exactly `frontend`. The repository root does not contain the Next.js `package.json`.
If the build fails with `Command "npm --prefix frontend install" exited with 254`, the Root Directory is already `frontend` but the project is still using old repo-root commands. Change the install command to `npm install` and the build command to `npm run build`.
If the build fails because `routes-manifest.json` could not be found, clear any custom **Output Directory** override. For a Next.js project, leave it at the default unless you changed Next.js `distDir`.

#### Deploy Backend API to Vercel

1. Create a second Vercel project from the same repo
2. Set **Root Directory** to `backend`
3. Set **Build Command** to `npm run build`
4. Add environment variables:
   - `DATABASE_URL=...`
   - `JWT_ACCESS_SECRET=...`
   - `JWT_REFRESH_SECRET=...`
   - `NODE_ENV=production`
   - `CORS_ORIGINS=https://notive.abbasaisolutions.com`
   - `CLIENT_URL=https://notive.abbasaisolutions.com`
   - `API_URL=https://api.abbasaisolutions.com/api/v1`
   - `TRUST_PROXY=1`
   - `AUTH_COOKIE_DOMAIN=.abbasaisolutions.com`
   - `AUTH_COOKIE_SAME_SITE=lax`
   - `ENABLE_HEALTH_CRON=false`
5. For a baseline Vercel-only deployment, also set:
   - `USE_EMBEDDINGS=false`
   - `NLP_SERVICE_URL=`
6. Add the production domain `api.abbasaisolutions.com`
7. In IONOS, point `api.abbasaisolutions.com` to the Vercel DNS target shown in the Vercel Domains tab

#### Backend Notes

- The backend project now serves the API through `backend/api/v1/[...route].ts`
- Local disk uploads are not a good fit for Vercel. Use object storage in production
- Preview frontend deployments may need extra CORS allow-list entries if you test auth against the production API

### Option 2: Vercel (Frontend) + Railway (Backend)

#### Deploy Backend to Railway

1. Create a Railway account at [railway.app](https://railway.app)
2. Create a new project
3. Add a PostgreSQL database
4. Deploy from GitHub:
   ```bash
   # Connect your GitHub repository
   # Railway will auto-detect the backend folder
   ```
5. Set environment variables in Railway dashboard
6. Note your backend URL (e.g., `https://your-app.railway.app`)

Railway monorepo note: this repository is an isolated monorepo. Set the Railway service **Root Directory** to `backend` so Railpack sees `backend/package.json`. If you use Config as Code, point Railway at `/backend/railway.json`, because Railway's config-file path is absolute and does not follow the Root Directory setting.

Runtime note: the backend workspace pins `packageManager` to `npm@10.9.3` and `engines.node` to Node 22 in `backend/package.json`. Keep Railway on Node 22 for this service, and when you intentionally regenerate `backend/package-lock.json`, do it with npm 10 from the `backend/` directory so `npm ci` stays reproducible between local and Railway builds.

Launch note: production uploads and push notifications are not fully ready from `DATABASE_URL` + JWT secrets alone. Before the first real mobile rollout, also configure:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_BUCKET_NAME`
- `AWS_REGION`
- `FIREBASE_SERVICE_ACCOUNT`
- `PUBLIC_SUPPORT_EMAIL`
- `SENTRY_DSN` (recommended)
- `REDIS_URL` (recommended)

See [RAILWAY_PRODUCTION_SETUP.md](./RAILWAY_PRODUCTION_SETUP.md) for the exact launch checklist, Firebase JSON handling, and post-deploy validation steps.

Initial admin note: to create or promote a production superadmin from a Railway shell, run:

```bash
npm run user:create-superadmin -- --email you@example.com --password StrongPass123 --name "Your Name"
```

If the user already exists, this promotes the account to `SUPERADMIN`. If the user does not exist yet, it creates one.

#### Deploy Frontend to Vercel

1. Create a Vercel account at [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure build settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
4. Set environment variables:
   - `NEXT_PUBLIC_APP_URL`: `https://notive.abbasaisolutions.com` or your production frontend URL
   - `NEXT_PUBLIC_API_URL`: Your Railway backend URL + `/api/v1`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `NEXT_PUBLIC_SUPPORT_EMAIL`: support address shown on privacy and account-deletion pages
5. Deploy!

If Vercel shows `No Next.js version detected`, the project is pointing at the wrong folder. Set **Root Directory** to `frontend`, because the Next.js app and its `package.json` live there.
If the Root Directory is already `frontend`, do not keep repo-root command overrides such as `npm --prefix frontend install` or `npm --prefix frontend run build`. In that setup, use `npm install` and `npm run build`.
Do not override **Output Directory** for this Next.js frontend. Even though static export writes an `out` folder, Vercel's Next.js deployment should use its default output handling.

### Option 3: Docker Deployment

#### Build Docker Images

```bash
# Backend
cd backend
docker build -t notive-backend .

# Frontend
cd ../frontend
docker build -t notive-frontend .
```

#### Run with Docker Compose

Create a `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: notive
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: notive_db
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    image: notive-backend
    environment:
      DATABASE_URL: postgresql://notive:${DB_PASSWORD}@postgres:5432/notive_db
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      NODE_ENV: production
    depends_on:
      - postgres
    ports:
      - "8000:8000"

  frontend:
    image: notive-frontend
    environment:
      NEXT_PUBLIC_API_URL: ${BACKEND_URL}/api/v1
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

Run with:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 4: Traditional VPS (DigitalOcean, AWS EC2, etc.)

1. **Set up the server**:
   ```bash
   # Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PostgreSQL
   sudo apt-get install postgresql postgresql-contrib
   
   # Install PM2 for process management
   sudo npm install -g pm2
   ```

2. **Clone and build**:
   ```bash
   git clone https://github.com/yourusername/notive.git
   cd notive
   
   # Backend
   cd backend
   npm install
   npm run build
   
   # Frontend
   cd ../frontend
   npm install
   npm run build
   ```

3. **Set up environment variables**:
   ```bash
   # Create .env files with production values
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   # Edit the files with your production values
   ```

4. **Run database migrations**:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

5. **Start with PM2**:
   ```bash
   # Backend
   cd backend
   pm2 start dist/index.js --name notive-backend
   
   # Frontend
   cd ../frontend
   pm2 start npm --name notive-frontend -- start
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

6. **Set up Nginx as reverse proxy** (optional but recommended):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       location /api {
           proxy_pass http://localhost:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Database Migrations

Always run migrations before deploying new versions:

```bash
cd backend
npx prisma migrate deploy
```

## Post-Deployment Checklist

- [ ] Database is accessible and migrations are applied
- [ ] Environment variables are set correctly
- [ ] Google OAuth redirect URIs are configured in Google Console
- [ ] CORS is configured correctly in backend
- [ ] SSL/HTTPS is enabled (use Let's Encrypt for free certificates)
- [ ] Health check endpoint is responding (`GET /`)
- [ ] Test login flow
- [ ] Test creating a journal entry
- [ ] Test voice input functionality
- [ ] Monitor logs for errors

## Troubleshooting

### "Failed to fetch" errors
- Check that `NEXT_PUBLIC_API_URL` is set correctly
- Verify CORS configuration in backend
- Check network/firewall rules

### Database connection errors
- Verify `DATABASE_URL` format
- Check database is running and accessible
- Ensure SSL mode is correct for your database provider

### Google OAuth not working
- Verify redirect URIs in Google Console match your deployment URL
- Check `GOOGLE_CLIENT_ID` is set in both frontend and backend
- Ensure cookies are enabled (required for refresh tokens)

## Monitoring and Maintenance

### View Logs

**PM2**:
```bash
pm2 logs notive-backend
pm2 logs notive-frontend
```

**Docker**:
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart Services

**PM2**:
```bash
pm2 restart notive-backend
pm2 restart notive-frontend
```

**Docker**:
```bash
docker-compose restart backend
docker-compose restart frontend
```

## Scaling Considerations

- Use a CDN (Cloudflare, Vercel Edge Network) for frontend assets
- Consider Redis for session storage and caching
- Set up database read replicas for high traffic
- Use a load balancer for multiple backend instances
- Monitor with tools like Datadog, New Relic, or Sentry
