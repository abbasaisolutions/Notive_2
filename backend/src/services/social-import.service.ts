// Social Media Import Service - Instagram & Facebook Integration
// File: backend/src/services/social-import.service.ts

import axios from 'axios';
import prisma from '../config/prisma';

// Types for social media data
export interface InstagramPost {
    id: string;
    caption?: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url: string;
    permalink: string;
    timestamp: string;
}

export interface FacebookPost {
    id: string;
    message?: string;
    created_time: string;
    full_picture?: string;
    place?: {
        name: string;
    };
}

export interface ImportResult {
    imported: number;
    skipped: number;
    errors: string[];
}

export class SocialImportService {
    // Instagram OAuth credentials (set in .env)
    private INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID || '';
    private INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET || '';
    private INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || '';

    // Facebook OAuth credentials
    private FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
    private FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
    private FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || '';

    /**
     * Save or update a social connection
     */
    async saveConnection(userId: string, provider: 'INSTAGRAM' | 'FACEBOOK', accessToken: string, expiresIn?: number): Promise<void> {
        await prisma.socialConnection.upsert({
            where: {
                userId_provider: { userId, provider }
            },
            create: {
                userId,
                provider,
                accessToken,
                expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null
            },
            update: {
                accessToken,
                expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                updatedAt: new Date()
            }
        });
    }

    /**
     * Get candidates (recent posts) for selection
     */
    async getCandidates(userId: string, provider: 'INSTAGRAM' | 'FACEBOOK'): Promise<any[]> {
        const connection = await prisma.socialConnection.findUnique({
            where: { userId_provider: { userId, provider } }
        });

        if (!connection) throw new Error(`${provider} is not connected.`);

        if (provider === 'INSTAGRAM') {
            return this.fetchInstagramPosts(connection.accessToken, 20); // Fetch top 20 for selection
        } else {
            return this.fetchFacebookPosts(connection.accessToken, 20);
        }
    }

    /**
     * Import selected posts in batch
     */
    async importBatch(userId: string, provider: 'INSTAGRAM' | 'FACEBOOK', selectedIds: string[]): Promise<ImportResult> {
        const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

        const connection = await prisma.socialConnection.findUnique({
            where: { userId_provider: { userId, provider } }
        });

        if (!connection) throw new Error(`${provider} is not connected.`);

        // For MVP, we refetch Recent and filter. 
        let posts: any[] = [];
        if (provider === 'INSTAGRAM') {
            posts = await this.fetchInstagramPosts(connection.accessToken, 50);
        } else {
            posts = await this.fetchFacebookPosts(connection.accessToken, 50);
        }

        const selectedPosts = posts.filter(p => selectedIds.includes(p.id));

        for (const post of selectedPosts) {
            try {
                // Check existing
                const existing = await prisma.entry.findFirst({
                    where: { userId, source: provider, externalId: post.id },
                });

                if (existing) {
                    result.skipped++;
                    continue;
                }

                let entryData: any = {
                    userId,
                    source: provider,
                    externalId: post.id,
                };

                if (provider === 'INSTAGRAM') {
                    const content = post.caption || 'Instagram Memory';
                    entryData = {
                        ...entryData,
                        content,
                        contentHtml: `<p>${content}</p>`,
                        mood: this.detectMood(content),
                        tags: this.extractHashtags(post.caption),
                        coverImage: post.media_url,
                        createdAt: new Date(post.timestamp)
                    };
                } else {
                    const content = post.message || 'Facebook Memory';
                    entryData = {
                        ...entryData,
                        content,
                        contentHtml: `<p>${content}</p>`,
                        mood: this.detectMood(content),
                        tags: this.extractHashtags(post.message),
                        coverImage: post.full_picture || null,
                        createdAt: new Date(post.created_time)
                    };
                }

                await prisma.entry.create({ data: entryData });
                result.imported++;
            } catch (error: any) {
                result.errors.push(`Post ${post.id}: ${error.message}`);
            }
        }

        return result;
    }

    /**
     * Generate Instagram OAuth authorization URL
     */
    getInstagramAuthUrl(userId: string): string {
        const state = this.encodeState({ userId, platform: 'instagram' });

        // Return Mock URL if client ID is missing
        if (!this.INSTAGRAM_CLIENT_ID) {
            return `${process.env.API_URL || 'http://localhost:8000/api/v1'}/import/callback/instagram?code=mock_code&state=${state}`;
        }

        return `https://api.instagram.com/oauth/authorize?client_id=${this.INSTAGRAM_CLIENT_ID}&redirect_uri=${encodeURIComponent(this.INSTAGRAM_REDIRECT_URI)}&scope=user_profile,user_media&response_type=code&state=${state}`;
    }

    /**
     * Generate Facebook OAuth authorization URL
     */
    getFacebookAuthUrl(userId: string): string {
        const state = this.encodeState({ userId, platform: 'facebook' });

        // Return Mock URL if app ID is missing
        if (!this.FACEBOOK_APP_ID) {
            return `${process.env.API_URL || 'http://localhost:8000/api/v1'}/import/callback/facebook?code=mock_code&state=${state}`;
        }

        return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${this.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(this.FACEBOOK_REDIRECT_URI)}&scope=user_posts&response_type=code&state=${state}`;
    }

    /**
     * Exchange Instagram authorization code for access token
     */
    async getInstagramAccessToken(code: string): Promise<string> {
        if (code === 'mock_code') return 'mock_access_token';

        const body = new URLSearchParams();
        body.set('client_id', this.INSTAGRAM_CLIENT_ID);
        body.set('client_secret', this.INSTAGRAM_CLIENT_SECRET);
        body.set('grant_type', 'authorization_code');
        body.set('redirect_uri', this.INSTAGRAM_REDIRECT_URI);
        body.set('code', code);

        const response = await axios.post<{ access_token: string }>(
            'https://api.instagram.com/oauth/access_token',
            body,
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        );

        return response.data.access_token;
    }

    /**
     * Exchange Facebook authorization code for access token
     */
    async getFacebookAccessToken(code: string): Promise<string> {
        if (code === 'mock_code') return 'mock_access_token';

        const response = await axios.get<{ access_token: string }>('https://graph.facebook.com/v18.0/oauth/access_token', {
            params: {
                client_id: this.FACEBOOK_APP_ID,
                client_secret: this.FACEBOOK_APP_SECRET,
                redirect_uri: this.FACEBOOK_REDIRECT_URI,
                code,
            },
        });

        return response.data.access_token;
    }

    /**
     * Fetch Instagram posts for a user
     */
    async fetchInstagramPosts(accessToken: string, limit = 50): Promise<InstagramPost[]> {
        if (accessToken === 'mock_access_token') {
            // Mock Data
            return [
                {
                    id: `ig_mock_${Date.now()}_1`,
                    caption: 'Reflecting on a beautiful sunset today. #grateful #nature',
                    media_type: 'IMAGE',
                    media_url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9d869?auto=format&fit=crop&w=800&q=80',
                    permalink: 'https://instagram.com/p/mock1',
                    timestamp: new Date().toISOString()
                },
                {
                    id: `ig_mock_${Date.now()}_2`,
                    caption: 'Coffee and coding. The best combo! ☕💻 #work #focus',
                    media_type: 'IMAGE',
                    media_url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
                    permalink: 'https://instagram.com/p/mock2',
                    timestamp: new Date(Date.now() - 86400000).toISOString()
                },
                {
                    id: `ig_mock_${Date.now()}_3`,
                    caption: 'Hiking the mountains. The air is so fresh! 🏔️ #hiking #nature',
                    media_type: 'IMAGE',
                    media_url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=80',
                    permalink: 'https://instagram.com/p/mock3',
                    timestamp: new Date(Date.now() - 86400000 * 2).toISOString()
                }
            ];
        }

        const posts: InstagramPost[] = [];
        let nextUrl: string | null = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,timestamp&access_token=${accessToken}&limit=${limit}`;

        while (nextUrl && posts.length < 200) { // Max 200 posts
            try {
                const { data } = await axios.get(nextUrl) as { data: { data: InstagramPost[]; paging?: { next?: string } } };
                posts.push(...data.data);
                nextUrl = data.paging?.next || null;

                // Respect rate limits
                await this.delay(100);
            } catch (error) {
                console.error('Instagram fetch error:', error);
                break;
            }
        }

        return posts;
    }

    /**
     * Fetch Facebook posts for a user
     */
    async fetchFacebookPosts(accessToken: string, limit = 100): Promise<FacebookPost[]> {
        if (accessToken === 'mock_access_token') {
            return [
                {
                    id: `fb_mock_${Date.now()}_1`,
                    message: 'Ideally, I would love to travel more this year. Planning a trip to Japan! 🇯🇵',
                    created_time: new Date().toISOString(),
                    full_picture: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80',
                    place: { name: 'Tokyo, Japan' }
                },
                {
                    id: `fb_mock_${Date.now()}_2`,
                    message: 'Had a great time with friends at the park.',
                    created_time: new Date(Date.now() - 172800000).toISOString(),
                },
                {
                    id: `fb_mock_${Date.now()}_3`,
                    message: 'Celebrating my birthday! 🎂',
                    created_time: new Date(Date.now() - 172800000 * 5).toISOString(),
                    full_picture: 'https://images.unsplash.com/photo-1530103862676-de3c9a59af57?auto=format&fit=crop&w=800&q=80',
                }
            ];
        }

        const posts: FacebookPost[] = [];
        let nextUrl: string | null = `https://graph.facebook.com/v18.0/me/posts?fields=id,message,created_time,full_picture,place&access_token=${accessToken}&limit=${limit}`;

        while (nextUrl && posts.length < 200) { // Max 200 posts
            try {
                const { data } = await axios.get(nextUrl) as { data: { data: FacebookPost[]; paging?: { next?: string } } };
                posts.push(...data.data);
                nextUrl = data.paging?.next || null;

                await this.delay(100);
            } catch (error) {
                console.error('Facebook fetch error:', error);
                break;
            }
        }

        return posts;
    }

    /**
     * Extract hashtags from post content
     */
    private extractHashtags(content?: string): string[] {
        if (!content) return [];
        const matches = content.match(/#(\w+)/g);
        return matches ? matches.map(tag => tag.slice(1).toLowerCase()) : [];
    }

    /**
     * Simple mood detection from content
     */
    private detectMood(content: string): string | null {
        const text = content.toLowerCase();

        const moodKeywords: Record<string, string[]> = {
            happy: ['happy', 'joy', 'excited', 'amazing', 'wonderful', 'great', 'love', '❤️', '😊', '🎉'],
            grateful: ['grateful', 'thankful', 'blessed', 'appreciate', '🙏'],
            motivated: ['motivated', 'inspired', 'determined', 'hustle', 'grind', '💪'],
            calm: ['peaceful', 'calm', 'relaxed', 'serene', 'zen', '😌'],
            sad: ['sad', 'miss', 'tears', 'heartbroken', '😢', '💔'],
            anxious: ['anxious', 'worried', 'stressed', 'nervous', '😰'],
        };

        for (const [mood, keywords] of Object.entries(moodKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return mood;
            }
        }

        return null;
    }

    /**
     * Encode state for OAuth (CSRF protection)
     */
    private encodeState(data: object): string {
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }

    /**
     * Decode OAuth state
     */
    decodeState(state: string): any {
        try {
            return JSON.parse(Buffer.from(state, 'base64').toString());
        } catch {
            return null;
        }
    }

    /**
     * Delay helper for rate limiting
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default new SocialImportService();
