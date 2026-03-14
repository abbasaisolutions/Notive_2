# Google Fit Integration

This document describes the Google Fit integration for Notive, enabling health-mood correlations and contextual insights.

## Overview

The Google Fit integration allows users to:
- **Optionally connect** their Google Fit account
- **Sync daily health data** (sleep, steps, heart rate)
- **View health-mood correlations** in their insights
- **See health context** alongside journal entries

This integration follows a **privacy-first** approach:
- Read-only access only
- User-initiated connection
- Easy disconnection
- Health data is never shared externally
- Used only for contextual insights, not medical advice

## Architecture

### Backend Services

```
backend/src/services/
├── googlefit-oauth.service.ts   # OAuth flow management
├── googlefit-api.service.ts     # Google Fit API calls
├── health-sync.service.ts       # Data sync & storage
├── health-cron.service.ts       # Scheduled sync jobs
└── health-insights.service.ts   # AI-powered correlations
```

### Database Schema

```prisma
model GoogleFitConnection {
  id           String    @id @default(cuid())
  userId       String    @unique
  accessToken  String    @db.Text  // Encrypted
  refreshToken String    @db.Text  // Encrypted
  expiresAt    DateTime
  scopes       String[]
  connectedAt  DateTime  @default(now())
  lastSyncAt   DateTime?
}

model HealthContext {
  id            String   @id @default(cuid())
  userId        String
  date          DateTime @db.Date
  sleepMinutes  Int?
  sleepQuality  String?  // poor, fair, good, excellent
  steps         Int?
  activeMinutes Int?
  avgHeartRate  Int?
  restingHeartRate Int?
  @@unique([userId, date])
}

model HealthInsight {
  id          String   @id @default(cuid())
  userId      String
  type        String   // sleep_mood, activity_mood, weekly_summary
  title       String
  description String   @db.Text
  data        Json?
  period      String   // day, week, month
  generatedAt DateTime @default(now())
}
```

## Setup Instructions

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your existing project (used for Google Sign-In)
3. **Enable the Fitness API:**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Fitness API" and enable it

4. **Add OAuth Scopes:**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Add these scopes:
     - `https://www.googleapis.com/auth/fitness.sleep.read`
     - `https://www.googleapis.com/auth/fitness.activity.read`
     - `https://www.googleapis.com/auth/fitness.heart_rate.read` (optional)

5. **Add Redirect URI:**
   - Go to "APIs & Services" > "Credentials"
   - Edit your OAuth 2.0 Client ID
   - Add redirect URI: `http://localhost:8000/api/v1/health/google-fit/callback`
   - For production: `https://yourdomain.com/api/v1/health/google-fit/callback`

### 2. Environment Variables

Add to your `.env` file:

```env
# Required - use your existing Google OAuth credentials
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Google Fit specific
GOOGLE_FIT_REDIRECT_URI=http://localhost:8000/api/v1/health/google-fit/callback
FRONTEND_URL=http://localhost:3000

# Security - generate a 32-character key
TOKEN_ENCRYPTION_KEY=your-32-character-encryption-key!

# Optional - disable cron for development
ENABLE_HEALTH_CRON=true
```

### 3. Run Prisma Migration

```bash
cd backend
npx prisma generate
npx prisma db push
# or
npx prisma migrate dev --name add_google_fit
```

### 4. Start the Server

The health sync cron jobs will start automatically with the server.

## API Endpoints

### Connection Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health/google-fit/status` | Get connection status |
| GET | `/health/google-fit/connect` | Initiate OAuth flow |
| GET | `/health/google-fit/callback` | OAuth callback (public) |
| POST | `/health/google-fit/disconnect` | Disconnect & revoke |

### Health Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health/context/today` | Get yesterday's health |
| GET | `/health/context/:date` | Get health for date |
| GET | `/health/context/range` | Get health for range |
| GET | `/health/stats` | Get aggregated stats |
| GET | `/health/insights` | Get health-mood insights |
| GET | `/health/weekly-summary` | Get weekly summary |

### Sync Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/health/sync` | Manual sync trigger |
| POST | `/health/backfill` | Backfill historical data |
| DELETE | `/health/data` | Delete all health data |

## Frontend Components

### GoogleFitConnection
Settings panel for connecting/disconnecting Google Fit.

```tsx
import GoogleFitConnection from '@/components/profile/GoogleFitConnection';

// In profile settings page
<GoogleFitConnection />
```

### HealthContextBadge
Shows health context on journal entries.

```tsx
import HealthContextBadge from '@/components/insights/HealthContextBadge';

<HealthContextBadge 
  context={healthContext}
  healthInsight={aiInsight}
  minimal={false}
/>
```

### HealthInsightsPanel
Dashboard panel for health-mood correlations.

```tsx
import HealthInsightsPanel from '@/components/insights/HealthInsightsPanel';

<HealthInsightsPanel period="month" />
```

### useHealthContext Hook
Fetch health context for entries.

```tsx
import { useHealthContext } from '@/hooks/useHealthContext';

const { healthContext, isConnected, isLoading } = useHealthContext();
```

## Data Flow

### Connection Flow
```
User clicks "Connect Google Fit"
    → Backend generates OAuth URL
    → User redirected to Google consent
    → User grants permissions
    → Google redirects to callback
    → Backend exchanges code for tokens
    → Tokens encrypted & stored
    → Initial backfill triggered (7 days)
    → User redirected to profile with success
```

### Daily Sync Flow
```
Cron job runs (every 6 hours)
    → Find all connected users
    → For each user:
        → Get valid access token (refresh if needed)
        → Fetch yesterday's data from Google Fit
        → Store aggregated data in HealthContext
        → Update lastSyncAt timestamp
```

### Insight Generation Flow
```
User views insights page
    → Fetch entries with moods
    → Fetch health contexts
    → Match by date
    → Analyze correlations (sleep vs mood, activity vs mood)
    → Generate AI insights
    → Return combined data
```

## Privacy & Security

### Token Security
- OAuth tokens are encrypted at rest using AES-256-CBC
- Refresh tokens are stored separately from access tokens
- Automatic token refresh with secure storage

### Data Minimization
- Only aggregated daily data is stored
- No minute-level data, location, or body metrics
- Sleep stages summarized into quality score

### User Control
- Connection is explicit and optional
- Easy disconnection with token revocation
- Option to delete all health data

### Trust Messaging
- Clear explanation of what data is accessed
- Privacy badge on connection UI
- "Read-only" emphasized throughout

## AI Integration

### Mood Detection Enhancement
Health context is optionally used to:
- Adjust mood confidence scoring
- Generate contextual insights ("Lower sleep may have influenced today's stress")
- Inform smart writing prompts

### Pattern Detection
```
Examples:
- "Your mood is more positive on days with 7+ hours of sleep"
- "Higher activity days correlate with improved mood"
- "Stress patterns appear on low-sleep days"
```

### Important Constraints
- Never provide medical advice
- Never diagnose conditions
- Use tentative language ("may have", "might", "could")
- Health data supports, never overrides user's own words

## Testing

### Manual Testing
1. Connect Google Fit in profile settings
2. Trigger manual sync
3. Check health context on entries
4. View insights page for correlations

### API Testing
```bash
# Check connection status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/health/google-fit/status

# Get today's health context
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/health/context/today

# Trigger manual sync
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/health/sync
```

## Troubleshooting

### "Failed to connect" Error
- Check that Fitness API is enabled in Google Cloud Console
- Verify OAuth scopes are added to consent screen
- Ensure redirect URI matches exactly

### No Health Data Appearing
- User needs health data in Google Fit first
- Wait for sync or trigger manual sync
- Check server logs for API errors

### Token Refresh Failures
- User may need to reconnect
- Check that refresh token was properly stored
- Verify client secret is correct

## Future Enhancements

- [ ] Apple Health integration (HealthKit)
- [ ] Heart rate variability (HRV) tracking
- [ ] Sleep stage visualization
- [ ] Cross-platform sync status
- [ ] Pattern clustering with ML
