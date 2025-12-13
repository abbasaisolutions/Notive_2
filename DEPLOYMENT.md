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

### Option 1: Vercel (Frontend) + Railway (Backend)

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

#### Deploy Frontend to Vercel

1. Create a Vercel account at [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure build settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
4. Set environment variables:
   - `NEXT_PUBLIC_API_URL`: Your Railway backend URL + `/api/v1`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Your Google OAuth client ID
5. Deploy!

### Option 2: Docker Deployment

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

### Option 3: Traditional VPS (DigitalOcean, AWS EC2, etc.)

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
