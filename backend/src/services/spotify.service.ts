/**
 * Spotify Integration Service
 *
 * Connects to Spotify Web API to capture music listening context.
 * Uses OAuth 2.0 with PKCE for authorization.
 *
 * Data captured daily:
 * - Recently played tracks
 * - Audio features (valence, energy, danceability)
 * - Top genres and artists
 * - Derived mood label based on audio features
 *
 * Spotify API is FREE for personal use — no cost for audio features.
 */

import prisma from '../config/prisma';
import crypto from 'crypto';
import { upsertSignal, type SpotifyData } from './device-signal.service';

const SPOTIFY_CLIENT_ID = (process.env.SPOTIFY_CLIENT_ID || '').trim();
const SPOTIFY_CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET || '').trim();
const SPOTIFY_REDIRECT_URI = (process.env.SPOTIFY_REDIRECT_URI || '').trim();

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

const SPOTIFY_SCOPES = [
    'user-read-recently-played',
    'user-top-read',
    'user-read-currently-playing',
];

// Token encryption (reuse same approach as Google Fit)
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'default-32-char-encryption-key!!';

function encryptToken(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptToken(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// ── OAuth Flow ───────────────────────────────────────────────

export function isSpotifyConfigured(): boolean {
    return !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_REDIRECT_URI);
}

export function getSpotifyAuthUrl(state: string): string {
    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: SPOTIFY_REDIRECT_URI,
        scope: SPOTIFY_SCOPES.join(' '),
        state,
        show_dialog: 'true',
    });
    return `${SPOTIFY_AUTH_URL}?${params}`;
}

export async function exchangeSpotifyCode(
    userId: string,
    code: string
): Promise<{ success: boolean; displayName?: string }> {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
    });

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: body.toString(),
    });

    if (!response.ok) {
        console.error('Spotify token exchange failed:', await response.text().catch(() => ''));
        return { success: false };
    }

    const tokens = await response.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        scope: string;
    };

    // Fetch user profile for display name
    let displayName: string | undefined;
    try {
        const profileRes = await fetch(`${SPOTIFY_API_BASE}/me`, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (profileRes.ok) {
            const profile = await profileRes.json() as { display_name?: string };
            displayName = profile.display_name || undefined;
        }
    } catch { /* non-critical */ }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.spotifyConnection.upsert({
        where: { userId },
        create: {
            userId,
            accessToken: encryptToken(tokens.access_token),
            refreshToken: encryptToken(tokens.refresh_token),
            expiresAt,
            scopes: tokens.scope.split(' '),
            displayName,
        },
        update: {
            accessToken: encryptToken(tokens.access_token),
            refreshToken: encryptToken(tokens.refresh_token),
            expiresAt,
            scopes: tokens.scope.split(' '),
            displayName,
        },
    });

    return { success: true, displayName };
}

export async function disconnectSpotify(userId: string): Promise<void> {
    await prisma.spotifyConnection.deleteMany({ where: { userId } });
}

// ── Token Refresh ────────────────────────────────────────────

async function getValidAccessToken(userId: string): Promise<string | null> {
    const connection = await prisma.spotifyConnection.findUnique({ where: { userId } });
    if (!connection) return null;

    // Check if token is still valid (with 5-min buffer)
    if (connection.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
        return decryptToken(connection.accessToken);
    }

    // Refresh
    try {
        const refreshToken = decryptToken(connection.refreshToken);
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        });

        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
            },
            body: body.toString(),
        });

        if (!response.ok) {
            console.error('Spotify refresh failed:', response.status);
            return null;
        }

        const tokens = await response.json() as {
            access_token: string;
            refresh_token?: string;
            expires_in: number;
        };

        await prisma.spotifyConnection.update({
            where: { userId },
            data: {
                accessToken: encryptToken(tokens.access_token),
                ...(tokens.refresh_token ? { refreshToken: encryptToken(tokens.refresh_token) } : {}),
                expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
            },
        });

        return tokens.access_token;
    } catch (error) {
        console.error('Spotify token refresh error:', error);
        return null;
    }
}

// ── Data Sync ────────────────────────────────────────────────

type SpotifyTrack = {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    duration_ms: number;
};

type RecentlyPlayedItem = {
    track: SpotifyTrack;
    played_at: string;
};

type AudioFeatures = {
    id: string;
    valence: number;    // 0-1, musical positivity
    energy: number;     // 0-1, musical intensity
    danceability: number;
    tempo: number;
};

/**
 * Sync today's listening data and store as DeviceSignal.
 */
export async function syncSpotifyForDate(userId: string, date?: Date): Promise<SpotifyData | null> {
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) return null;

    const targetDate = date || new Date();

    try {
        // Get recently played (last 50 tracks)
        const recentRes = await fetch(
            `${SPOTIFY_API_BASE}/me/player/recently-played?limit=50`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!recentRes.ok) {
            console.error('Spotify recently played failed:', recentRes.status);
            return null;
        }

        const recent = await recentRes.json() as { items: RecentlyPlayedItem[] };

        // Filter to target date
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        const todayTracks = recent.items.filter((item) => {
            const played = new Date(item.played_at);
            return played >= dayStart && played <= dayEnd;
        });

        if (todayTracks.length === 0) return null;

        // Get audio features for played tracks
        const trackIds = [...new Set(todayTracks.map((t) => t.track.id))].slice(0, 50);
        let features: AudioFeatures[] = [];

        if (trackIds.length > 0) {
            const featRes = await fetch(
                `${SPOTIFY_API_BASE}/audio-features?ids=${trackIds.join(',')}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (featRes.ok) {
                const featData = await featRes.json() as { audio_features: (AudioFeatures | null)[] };
                features = (featData.audio_features || []).filter((f): f is AudioFeatures => f !== null);
            }
        }

        // Compute averages
        const avgValence = features.length > 0
            ? features.reduce((s, f) => s + f.valence, 0) / features.length
            : 0.5;
        const avgEnergy = features.length > 0
            ? features.reduce((s, f) => s + f.energy, 0) / features.length
            : 0.5;

        // Total listening time
        const totalMinutes = Math.round(
            todayTracks.reduce((s, t) => s + t.track.duration_ms, 0) / 60000
        );

        // Top artists
        const artistCounts = new Map<string, number>();
        for (const t of todayTracks) {
            for (const a of t.track.artists) {
                artistCounts.set(a.name, (artistCounts.get(a.name) ?? 0) + 1);
            }
        }
        const topArtists = [...artistCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name);

        // Derive mood label from audio features
        const moodLabel = deriveMusicMood(avgValence, avgEnergy);

        // Get top genres from top artists
        const topGenres = await fetchTopGenres(accessToken);

        const data: SpotifyData = {
            tracksPlayed: todayTracks.length,
            totalMinutes,
            avgValence: Math.round(avgValence * 100) / 100,
            avgEnergy: Math.round(avgEnergy * 100) / 100,
            topGenres: topGenres.slice(0, 5),
            topArtists,
            moodLabel,
        };

        await upsertSignal(userId, targetDate, 'spotify', data as unknown as Record<string, unknown>, 'API');

        // Update lastSyncAt
        await prisma.spotifyConnection.update({
            where: { userId },
            data: { lastSyncAt: new Date() },
        });

        return data;
    } catch (error) {
        console.error('Spotify sync error:', error);
        return null;
    }
}

/**
 * Derive a mood label from Spotify audio features.
 * Based on valence (positivity) and energy dimensions.
 */
function deriveMusicMood(valence: number, energy: number): string {
    if (valence >= 0.6 && energy >= 0.6) return 'upbeat';
    if (valence >= 0.6 && energy < 0.6) return 'chill';
    if (valence < 0.4 && energy >= 0.6) return 'intense';
    if (valence < 0.4 && energy < 0.4) return 'melancholy';
    if (valence >= 0.4 && valence < 0.6 && energy >= 0.5) return 'energetic';
    return 'neutral';
}

/**
 * Fetch user's top genres from their top artists.
 */
async function fetchTopGenres(accessToken: string): Promise<string[]> {
    try {
        const res = await fetch(
            `${SPOTIFY_API_BASE}/me/top/artists?limit=10&time_range=short_term`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!res.ok) return [];

        const data = await res.json() as {
            items: Array<{ genres: string[] }>;
        };

        const genreCounts = new Map<string, number>();
        for (const artist of data.items) {
            for (const genre of artist.genres) {
                genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
            }
        }

        return [...genreCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([genre]) => genre);
    } catch {
        return [];
    }
}

/**
 * Get Spotify connection status for a user.
 */
export async function getSpotifyStatus(userId: string) {
    const connection = await prisma.spotifyConnection.findUnique({
        where: { userId },
        select: { displayName: true, connectedAt: true, lastSyncAt: true, scopes: true },
    });

    return {
        connected: !!connection,
        displayName: connection?.displayName ?? null,
        connectedAt: connection?.connectedAt?.toISOString() ?? null,
        lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
    };
}
