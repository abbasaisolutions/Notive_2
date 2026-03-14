// Social Media Import Service - Instagram & Facebook Integration
// File: backend/src/services/social-import.service.ts

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import prisma from '../config/prisma';
import { Prisma, TagSource } from '@prisma/client';
import { buildTagMetaList, syncEntryTags } from './tag-manager.service';
import embeddingService from './embedding.service';

// Types for social media data
export interface InstagramPost {
    id: string;
    caption?: string;
    media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
    media_url?: string;
    permalink?: string;
    timestamp: string;
}

export interface FacebookPost {
    id: string;
    message?: string;
    story?: string;
    created_time: string;
    full_picture?: string;
    permalink_url?: string;
    attachments?: unknown;
    place?: {
        name: string;
    };
}

export interface ImportCandidate {
    id: string;
    provider: 'instagram' | 'facebook';
    text: string;
    imageUrl: string | null;
    createdAt: string;
    sourceLink: string | null;
    tags: string[];
}

export interface ConnectionSummary {
    provider: 'instagram' | 'facebook';
    connected: boolean;
    connectedAt: string | null;
    updatedAt: string | null;
    expiresAt: string | null;
    isExpired: boolean;
    accountId: string | null;
}

export interface ImportResult {
    imported: number;
    skipped: number;
    errors: string[];
}

interface EntryImportCreateData {
    userId: string;
    source: 'INSTAGRAM' | 'FACEBOOK';
    externalId: string;
    sourceLink: string | null;
    title: string;
    content: string;
    contentHtml: string;
    mood: string | null;
    tags: string[];
    coverImage: string | null;
    category: 'PERSONAL';
    lifeArea: string | null;
    createdAt: Date;
    analysis: Prisma.InputJsonValue;
}

interface ArchivePost {
    id?: string;
    content: string;
    createdAt?: Date | null;
    mediaUris: string[];
    sourceLink?: string;
}

interface ArchiveImportResult extends ImportResult {
    total: number;
}

interface ArchiveParseResult {
    posts: ArchivePost[];
    archiveDir: string | null;
    cleanup?: () => void;
}

interface OAuthTokenResult {
    accessToken: string;
    expiresIn?: number;
}

interface OAuthStateInput {
    userId: string;
    platform: 'instagram' | 'facebook';
    returnTo: string;
    clientOrigin?: string;
}

export interface OAuthStateData extends OAuthStateInput {
    nonce: string;
    issuedAt: number;
    expiresAt: number;
}

interface InstagramGraphAccount {
    id: string;
    username: string | null;
}

interface OAuthUrlOptions {
    forceReauth?: boolean;
    clientOrigin?: string;
    apiBaseUrl?: string;
}

const DEFAULT_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const SOCIAL_TOKEN_ENCRYPTION_PREFIX = 'enc:v1';

const parseOAuthStateTtlMs = (): number => {
    const rawValue = Number(process.env.OAUTH_STATE_TTL_MS);
    if (Number.isFinite(rawValue) && rawValue > 0) {
        return rawValue;
    }
    return DEFAULT_OAUTH_STATE_TTL_MS;
};

export class SocialImportService {
    // Instagram OAuth credentials (set in .env). Falls back to Facebook app for shared Meta app setups.
    private INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || process.env.INSTAGRAM_CLIENT_ID || process.env.FACEBOOK_APP_ID || '';
    private INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || process.env.INSTAGRAM_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET || '';
    private INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || '';

    // Facebook OAuth credentials
    private FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
    private FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
    private FACEBOOK_REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || '';
    private META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v22.0';
    private OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.JWT_REFRESH_SECRET || process.env.JWT_ACCESS_SECRET || '';
    private OAUTH_STATE_TTL_MS = parseOAuthStateTtlMs();
    private SOCIAL_TOKEN_ENCRYPTION_SECRET = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || process.env.JWT_REFRESH_SECRET || process.env.JWT_ACCESS_SECRET || '';

    /**
     * Save or update a social connection
     */
    async saveConnection(userId: string, provider: 'INSTAGRAM' | 'FACEBOOK', accessToken: string, expiresIn?: number): Promise<void> {
        const providerId = await this.fetchProviderIdentity(provider, accessToken);
        const encryptedAccessToken = this.encryptSocialAccessToken(accessToken);

        await prisma.socialConnection.upsert({
            where: {
                userId_provider: { userId, provider }
            },
            create: {
                userId,
                provider,
                providerId,
                accessToken: encryptedAccessToken,
                expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null
            },
            update: {
                providerId,
                accessToken: encryptedAccessToken,
                expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                updatedAt: new Date()
            }
        });
    }

    async disconnectConnection(userId: string, provider: 'INSTAGRAM' | 'FACEBOOK'): Promise<void> {
        await prisma.socialConnection.deleteMany({
            where: { userId, provider },
        });
    }

    async getConnectionSummaries(userId: string): Promise<Record<string, ConnectionSummary>> {
        const rows = await prisma.socialConnection.findMany({
            where: { userId },
            select: {
                provider: true,
                providerId: true,
                createdAt: true,
                updatedAt: true,
                expiresAt: true,
            },
        });

        const emptySummary = (provider: 'instagram' | 'facebook'): ConnectionSummary => ({
            provider,
            connected: false,
            connectedAt: null,
            updatedAt: null,
            expiresAt: null,
            isExpired: false,
            accountId: null,
        });

        const summary: Record<string, ConnectionSummary> = {
            instagram: emptySummary('instagram'),
            facebook: emptySummary('facebook'),
        };

        for (const row of rows) {
            const key = row.provider.toLowerCase();
            if (key !== 'instagram' && key !== 'facebook') continue;
            const now = Date.now();
            const expiresAt = row.expiresAt ? row.expiresAt.getTime() : null;
            summary[key] = {
                provider: key,
                connected: true,
                connectedAt: row.createdAt?.toISOString() || null,
                updatedAt: row.updatedAt?.toISOString() || null,
                expiresAt: row.expiresAt?.toISOString() || null,
                isExpired: typeof expiresAt === 'number' ? expiresAt <= now : false,
                accountId: row.providerId || null,
            };
        }

        return summary;
    }

    /**
     * Get candidates (recent posts) for selection
     */
    async getCandidates(userId: string, provider: 'INSTAGRAM' | 'FACEBOOK'): Promise<ImportCandidate[]> {
        const connection = await prisma.socialConnection.findUnique({
            where: { userId_provider: { userId, provider } }
        });

        if (!connection) throw new Error(`${provider} is not connected.`);
        if (connection.expiresAt && connection.expiresAt.getTime() <= Date.now()) {
            throw new Error(`${provider} connection expired. Please reconnect.`);
        }
        const accessToken = this.decryptSocialAccessToken(connection.accessToken);

        if (provider === 'INSTAGRAM') {
            const posts = await this.fetchInstagramPosts(accessToken, 40);
            return posts.map((post) => ({
                id: post.id,
                provider: 'instagram',
                text: this.normalizeContent(post.caption, 'Instagram memory'),
                imageUrl: post.media_url || null,
                createdAt: this.normalizeDate(post.timestamp).toISOString(),
                sourceLink: post.permalink || null,
                tags: this.buildImportTags('INSTAGRAM', post.caption),
            }));
        }

        const posts = await this.fetchFacebookPosts(accessToken, 40);
        return posts.map((post) => {
            const content = this.normalizeContent(post.message || post.story, 'Facebook memory');
            return {
                id: post.id,
                provider: 'facebook',
                text: content,
                imageUrl: post.full_picture || null,
                createdAt: this.normalizeDate(post.created_time).toISOString(),
                sourceLink: post.permalink_url || null,
                tags: this.buildImportTags('FACEBOOK', content),
            };
        });
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
        if (connection.expiresAt && connection.expiresAt.getTime() <= Date.now()) {
            throw new Error(`${provider} connection expired. Please reconnect.`);
        }
        const accessToken = this.decryptSocialAccessToken(connection.accessToken);

        let posts: Array<InstagramPost | FacebookPost> = [];
        if (provider === 'INSTAGRAM') {
            posts = await this.fetchInstagramPosts(accessToken, 120);
        } else {
            posts = await this.fetchFacebookPosts(accessToken, 120);
        }

        const selectedIdSet = new Set(selectedIds.filter(Boolean));
        const selectedPosts = posts.filter((p) => selectedIdSet.has(p.id));
        const existingExternalIds = await this.fetchExistingExternalIds(
            userId,
            provider,
            selectedPosts.map((p) => p.id)
        );

        for (const post of selectedPosts) {
            try {
                if (existingExternalIds.has(post.id)) {
                    result.skipped++;
                    continue;
                }

                const entryData = provider === 'INSTAGRAM'
                    ? this.mapInstagramPostToEntryData(userId, post as InstagramPost)
                    : this.mapFacebookPostToEntryData(userId, post as FacebookPost);

                const createdEntry = await prisma.entry.create({ data: entryData });
                if (entryData.tags && entryData.tags.length > 0) {
                    await syncEntryTags({
                        entryId: createdEntry.id,
                        userId,
                        tags: buildTagMetaList(entryData.tags.map((tag: string) => ({
                            name: tag,
                            source: TagSource.IMPORT,
                            confidence: 0.7,
                        }))),
                    });
                }
                embeddingService.enqueueEntryEmbedding({
                    entryId: createdEntry.id,
                    userId,
                    content: entryData.content,
                    title: entryData.title || null,
                });
                existingExternalIds.add(post.id);
                result.imported++;
            } catch (error: any) {
                result.errors.push(`Post ${post.id}: ${error.message}`);
            }
        }

        return result;
    }

    /**
     * Import from a data archive (ZIP or JSON)
     */
    async importArchive(userId: string, provider: 'INSTAGRAM' | 'FACEBOOK', file: Express.Multer.File): Promise<ArchiveImportResult> {
        const result: ArchiveImportResult = { imported: 0, skipped: 0, errors: [], total: 0 };
        const originalName = file.originalname || 'archive';
        const ext = path.extname(originalName).toLowerCase();
        const isZip = ext === '.zip' || (file.mimetype || '').includes('zip');

        const { posts, archiveDir, cleanup } = this.parseArchive(provider, file.buffer, isZip);
        result.total = posts.length;

        const maxImport = 1000;
        const limitedPosts = posts.slice(0, maxImport);
        const mediaIndex = archiveDir ? this.buildMediaIndex(archiveDir) : null;
        const preparedPosts = limitedPosts.map(post => ({
            post,
            externalId: this.buildArchiveExternalId(provider, post),
        }));
        const existingExternalIds = await this.fetchExistingExternalIds(
            userId,
            provider,
            preparedPosts.map(item => item.externalId)
        );

        try {
            for (const { post, externalId } of preparedPosts) {
                try {
                    if (existingExternalIds.has(externalId)) {
                        result.skipped++;
                        continue;
                    }

                    const content = this.normalizeContent(post.content, `${provider} memory`);
                    const coverImage = this.extractArchiveCoverImage(archiveDir, mediaIndex, post.mediaUris);
                    const createdAt = post.createdAt ? new Date(post.createdAt) : new Date();
                    const tags = this.buildImportTags(provider, content);

                    const entryData: any = {
                        userId,
                        source: provider,
                        externalId,
                        sourceLink: post.sourceLink || null,
                        title: this.buildEntryTitle(provider, content, createdAt),
                        content,
                        contentHtml: this.toParagraphHtml(content),
                        mood: this.detectMood(content),
                        tags,
                        coverImage: coverImage || null,
                        category: 'PERSONAL',
                        lifeArea: 'Life',
                        createdAt,
                        analysis: {
                            import: {
                                provider,
                                mode: 'archive',
                                importedAt: new Date().toISOString(),
                                hasMedia: Boolean(coverImage),
                            },
                        },
                    };

                    const createdEntry = await prisma.entry.create({ data: entryData });
                    if (entryData.tags && entryData.tags.length > 0) {
                        await syncEntryTags({
                            entryId: createdEntry.id,
                            userId,
                            tags: buildTagMetaList(entryData.tags.map((tag: string) => ({
                                name: tag,
                                source: TagSource.IMPORT,
                                confidence: 0.7,
                            }))),
                        });
                    }
                    embeddingService.enqueueEntryEmbedding({
                        entryId: createdEntry.id,
                        userId,
                        content: entryData.content,
                        title: entryData.title || null,
                    });
                    existingExternalIds.add(externalId);
                    result.imported++;
                } catch (error: any) {
                    result.errors.push(`Archive item: ${error.message}`);
                }
            }
        } finally {
            if (cleanup) {
                cleanup();
            }
        }

        return result;
    }

    /**
     * Generate Instagram OAuth authorization URL
     */
    getInstagramAuthUrl(userId: string, returnTo?: string, options?: OAuthUrlOptions): string {
        const redirectUri = this.getResolvedRedirectUri('INSTAGRAM', options?.apiBaseUrl);
        this.assertOAuthConfig('INSTAGRAM', redirectUri);
        if (!redirectUri) {
            throw new Error('Instagram redirect URI could not be resolved.');
        }
        const state = this.encodeState({
            userId,
            platform: 'instagram',
            returnTo: this.normalizeReturnTo(returnTo),
            clientOrigin: this.normalizeClientOrigin(options?.clientOrigin),
        });

        return this.buildFacebookDialogUrl({
            clientId: this.INSTAGRAM_APP_ID,
            redirectUri,
            scope: [
                'instagram_basic',
                'pages_show_list',
                'pages_read_engagement',
            ],
            state,
            forceReauth: Boolean(options?.forceReauth),
        });
    }

    /**
     * Generate Facebook OAuth authorization URL
     */
    getFacebookAuthUrl(userId: string, returnTo?: string, options?: OAuthUrlOptions): string {
        const redirectUri = this.getResolvedRedirectUri('FACEBOOK', options?.apiBaseUrl);
        this.assertOAuthConfig('FACEBOOK', redirectUri);
        if (!redirectUri) {
            throw new Error('Facebook redirect URI could not be resolved.');
        }
        const state = this.encodeState({
            userId,
            platform: 'facebook',
            returnTo: this.normalizeReturnTo(returnTo),
            clientOrigin: this.normalizeClientOrigin(options?.clientOrigin),
        });

        return this.buildFacebookDialogUrl({
            clientId: this.FACEBOOK_APP_ID,
            redirectUri,
            scope: ['public_profile', 'user_posts', 'user_photos'],
            state,
            forceReauth: Boolean(options?.forceReauth),
        });
    }

    /**
     * Exchange Instagram authorization code for access token
     */
    async getInstagramAccessToken(code: string, apiBaseUrl?: string): Promise<OAuthTokenResult> {
        const redirectUri = this.getResolvedRedirectUri('INSTAGRAM', apiBaseUrl);
        this.assertOAuthConfig('INSTAGRAM', redirectUri);
        if (!redirectUri) {
            throw new Error('Instagram redirect URI could not be resolved.');
        }
        return this.exchangeCodeForAccessToken({
            appId: this.INSTAGRAM_APP_ID,
            appSecret: this.INSTAGRAM_APP_SECRET,
            redirectUri,
            code,
        });
    }

    /**
     * Exchange Facebook authorization code for access token
     */
    async getFacebookAccessToken(code: string, apiBaseUrl?: string): Promise<OAuthTokenResult> {
        const redirectUri = this.getResolvedRedirectUri('FACEBOOK', apiBaseUrl);
        this.assertOAuthConfig('FACEBOOK', redirectUri);
        if (!redirectUri) {
            throw new Error('Facebook redirect URI could not be resolved.');
        }
        return this.exchangeCodeForAccessToken({
            appId: this.FACEBOOK_APP_ID,
            appSecret: this.FACEBOOK_APP_SECRET,
            redirectUri,
            code,
        });
    }

    private buildFacebookDialogUrl(params: {
        clientId: string;
        redirectUri: string;
        scope: string[];
        state: string;
        forceReauth?: boolean;
    }): string {
        const query = new URLSearchParams({
            client_id: params.clientId,
            redirect_uri: params.redirectUri,
            scope: params.scope.join(','),
            response_type: 'code',
            state: params.state,
            auth_type: params.forceReauth ? 'reauthenticate' : 'rerequest',
        });
        if (params.forceReauth) {
            query.set('auth_nonce', crypto.randomUUID());
        }
        return `https://www.facebook.com/${this.META_GRAPH_API_VERSION}/dialog/oauth?${query.toString()}`;
    }

    private getGraphBaseUrl(): string {
        return `https://graph.facebook.com/${this.META_GRAPH_API_VERSION}`;
    }

    private assertOAuthConfig(provider: 'INSTAGRAM' | 'FACEBOOK', redirectUri: string | null): void {
        if (provider === 'INSTAGRAM') {
            if (!this.INSTAGRAM_APP_ID || !this.INSTAGRAM_APP_SECRET || !redirectUri) {
                throw new Error(
                    'Social OAuth not configured for Instagram. Set INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and a valid INSTAGRAM_REDIRECT_URI or API_URL.'
                );
            }
            return;
        }

        if (!this.FACEBOOK_APP_ID || !this.FACEBOOK_APP_SECRET || !redirectUri) {
            throw new Error(
                'Social OAuth not configured for Facebook. Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, and a valid FACEBOOK_REDIRECT_URI or API_URL.'
            );
        }
    }

    private async exchangeCodeForAccessToken(params: {
        appId: string;
        appSecret: string;
        redirectUri: string;
        code: string;
    }): Promise<OAuthTokenResult> {
        const response = await axios.get(`${this.getGraphBaseUrl()}/oauth/access_token`, {
            params: {
                client_id: params.appId,
                client_secret: params.appSecret,
                redirect_uri: params.redirectUri,
                code: params.code,
            },
        });

        const shortLivedToken = typeof response.data?.access_token === 'string' ? response.data.access_token : '';
        const shortLivedExpiry = typeof response.data?.expires_in === 'number' ? response.data.expires_in : undefined;
        if (!shortLivedToken) {
            throw new Error('OAuth token exchange failed: access token missing.');
        }

        try {
            const longLived = await this.exchangeForLongLivedToken(shortLivedToken, params.appId, params.appSecret);
            if (longLived) return longLived;
        } catch (error) {
            console.warn('Long-lived token exchange failed, using short-lived token', error);
        }

        return {
            accessToken: shortLivedToken,
            expiresIn: shortLivedExpiry,
        };
    }

    private async exchangeForLongLivedToken(
        accessToken: string,
        appId: string,
        appSecret: string
    ): Promise<OAuthTokenResult | null> {
        const response = await axios.get(`${this.getGraphBaseUrl()}/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: accessToken,
            },
        });

        const longToken = typeof response.data?.access_token === 'string' ? response.data.access_token : '';
        if (!longToken) return null;

        return {
            accessToken: longToken,
            expiresIn: typeof response.data?.expires_in === 'number' ? response.data.expires_in : undefined,
        };
    }

    /**
     * Fetch Instagram posts for a user
     */
    async fetchInstagramPosts(accessToken: string, limit = 50): Promise<InstagramPost[]> {
        const account = await this.resolveInstagramGraphAccount(accessToken);
        const pageLimit = Math.max(1, Math.min(limit, 100));

        const posts: InstagramPost[] = [];
        let nextUrl: string | null = `${this.getGraphBaseUrl()}/${account.id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${accessToken}&limit=${pageLimit}`;

        while (nextUrl && posts.length < 200) { // Max 200 posts
            try {
                const response: { data?: any } = await axios.get(nextUrl);
                const data = Array.isArray(response.data?.data) ? response.data.data : [];
                posts.push(...data.map((item: any) => ({
                    id: String(item.id),
                    caption: typeof item.caption === 'string' ? item.caption : undefined,
                    media_type: item.media_type === 'VIDEO' || item.media_type === 'CAROUSEL_ALBUM' ? item.media_type : 'IMAGE',
                    media_url: typeof item.media_url === 'string'
                        ? item.media_url
                        : (typeof item.thumbnail_url === 'string' ? item.thumbnail_url : undefined),
                    permalink: typeof item.permalink === 'string' ? item.permalink : undefined,
                    timestamp: typeof item.timestamp === 'string' ? item.timestamp : new Date().toISOString(),
                })));
                nextUrl = response.data.paging?.next || null;

                await this.delay(100);
            } catch (error) {
                console.error('Instagram fetch error:', error);
                throw this.toProviderError('Instagram', error);
            }
        }

        return posts;
    }

    /**
     * Fetch Facebook posts for a user
     */
    async fetchFacebookPosts(accessToken: string, limit = 100): Promise<FacebookPost[]> {
        const posts: FacebookPost[] = [];
        const pageLimit = Math.max(1, Math.min(limit, 100));
        let nextUrl: string | null =
            `${this.getGraphBaseUrl()}/me/posts?fields=id,message,story,created_time,full_picture,permalink_url,attachments{media,type,url,title,description,subattachments}&access_token=${accessToken}&limit=${pageLimit}`;

        while (nextUrl && posts.length < 200) {
            try {
                const response: { data?: any } = await axios.get(nextUrl);
                const data = Array.isArray(response.data?.data) ? response.data.data : [];
                posts.push(...data);
                nextUrl = response.data.paging?.next || null;

                await this.delay(100);
            } catch (error) {
                console.error('Facebook fetch error:', error);
                throw this.toProviderError('Facebook', error);
            }
        }

        return posts;
    }

    /**
     * Parse a social archive (ZIP or JSON) and return normalized posts
     */
    private parseArchive(provider: 'INSTAGRAM' | 'FACEBOOK', buffer: Buffer, isZip: boolean): ArchiveParseResult {
        let posts: ArchivePost[] = [];
        let archiveDir: string | null = null;
        let cleanup: (() => void) | undefined;

        if (isZip) {
            const extracted = this.extractZipToTemp(buffer);
            archiveDir = extracted.dir;
            cleanup = extracted.cleanup;

            const jsonFiles = this.listJsonFiles(archiveDir).filter((filePath: string) => {
                const lower = filePath.toLowerCase();
                return lower.includes('post') || lower.includes('media') || lower.includes('content');
            });

            for (const filePath of jsonFiles) {
                const json = this.safeJsonParse(fs.readFileSync(filePath, 'utf8'));
                if (!json) continue;

                const extractedPosts = provider === 'INSTAGRAM'
                    ? this.extractInstagramArchivePosts(json)
                    : this.extractFacebookArchivePosts(json);

                posts.push(...extractedPosts);
            }
        } else {
            const json = this.safeJsonParse(buffer.toString('utf8'));
            if (json) {
                posts = provider === 'INSTAGRAM'
                    ? this.extractInstagramArchivePosts(json)
                    : this.extractFacebookArchivePosts(json);
            }
        }

        const normalized = this.normalizeArchivePosts(provider, posts);
        return { posts: normalized, archiveDir, cleanup };
    }

    private extractInstagramArchivePosts(data: any): ArchivePost[] {
        const posts: ArchivePost[] = [];

        const pushItem = (item: any) => {
            const caption =
                item?.caption ||
                item?.title ||
                item?.text ||
                item?.string_map_data?.Caption?.value ||
                item?.string_map_data?.caption?.value ||
                item?.string_map_data?.['Caption']?.value ||
                '';

            const timestamp =
                item?.timestamp ||
                item?.creation_timestamp ||
                item?.created_time ||
                item?.media?.[0]?.timestamp ||
                item?.media?.[0]?.creation_timestamp ||
                null;

            const mediaUris: string[] = [];
            if (typeof item?.media_url === 'string') mediaUris.push(item.media_url);
            if (Array.isArray(item?.media)) {
                item.media.forEach((m: any) => {
                    if (typeof m?.uri === 'string') mediaUris.push(m.uri);
                    if (typeof m?.media_url === 'string') mediaUris.push(m.media_url);
                });
            }

            const sourceLink =
                item?.permalink ||
                item?.link ||
                item?.string_map_data?.['URI']?.value ||
                item?.string_map_data?.uri?.value ||
                undefined;

            posts.push({
                id: item?.id,
                content: caption,
                createdAt: this.coerceDate(timestamp),
                mediaUris,
                sourceLink,
            });
        };

        const walk = (node: any, depth = 0) => {
            if (!node || depth > 5) return;
            if (Array.isArray(node)) {
                node.forEach(item => walk(item, depth + 1));
                return;
            }
            if (typeof node !== 'object') return;

            const looksLikePost =
                node?.media_type ||
                node?.caption ||
                node?.permalink ||
                node?.timestamp ||
                node?.creation_timestamp ||
                (Array.isArray(node?.media) && node.media.length);

            if (looksLikePost) {
                pushItem(node);
            }

            const keys = ['media', 'items', 'posts', 'data', 'your_instagram_activity'];
            keys.forEach(key => {
                if (node[key]) walk(node[key], depth + 1);
            });
        };

        walk(data);
        return posts;
    }

    private extractFacebookArchivePosts(data: any): ArchivePost[] {
        const posts: ArchivePost[] = [];

        const collectMediaUris = (node: any, list: string[]) => {
            if (!node) return;
            if (Array.isArray(node)) {
                node.forEach(item => collectMediaUris(item, list));
                return;
            }
            if (typeof node !== 'object') return;
            if (typeof node.uri === 'string' && this.looksLikeMediaPath(node.uri)) {
                list.push(node.uri);
            }
            if (typeof node.media_url === 'string') {
                list.push(node.media_url);
            }
            if (node.media) collectMediaUris(node.media, list);
            if (node.photo) collectMediaUris(node.photo, list);
            if (node.attachments) collectMediaUris(node.attachments, list);
            if (node.data) collectMediaUris(node.data, list);
        };

        const pushItem = (item: any) => {
            const textFromData = Array.isArray(item?.data)
                ? item.data.map((d: any) => d?.post || d?.update || d?.title || d?.text).filter(Boolean).join('\n')
                : '';

            const message =
                item?.post ||
                item?.message ||
                item?.title ||
                textFromData ||
                '';

            const timestamp =
                item?.timestamp ||
                item?.created_time ||
                item?.creation_timestamp ||
                null;

            const mediaUris: string[] = [];
            collectMediaUris(item?.attachments, mediaUris);
            collectMediaUris(item?.media, mediaUris);

            const sourceLink =
                item?.permalink_url ||
                item?.link ||
                item?.uri ||
                undefined;

            posts.push({
                id: item?.id,
                content: message,
                createdAt: this.coerceDate(timestamp),
                mediaUris,
                sourceLink,
            });
        };

        const walk = (node: any, depth = 0) => {
            if (!node || depth > 5) return;
            if (Array.isArray(node)) {
                node.forEach(item => walk(item, depth + 1));
                return;
            }
            if (typeof node !== 'object') return;

            const looksLikePost =
                node?.post ||
                node?.message ||
                node?.timestamp ||
                node?.created_time ||
                node?.attachments;

            if (looksLikePost) {
                pushItem(node);
            }

            const keys = ['posts', 'data', 'items'];
            keys.forEach(key => {
                if (node[key]) walk(node[key], depth + 1);
            });
        };

        walk(data);
        return posts;
    }

    private normalizeArchivePosts(provider: 'INSTAGRAM' | 'FACEBOOK', posts: ArchivePost[]): ArchivePost[] {
        const deduped = new Map<string, ArchivePost>();

        posts.forEach(post => {
            const content = (post.content || '').trim();
            const mediaUris = (post.mediaUris || []).filter(Boolean);
            const createdAt = post.createdAt ? new Date(post.createdAt) : null;

            const signature = this.buildArchiveSignature(provider, {
                ...post,
                content,
                mediaUris,
                createdAt,
            });

            if (!deduped.has(signature)) {
                deduped.set(signature, {
                    ...post,
                    id: signature,
                    content: content || `${provider} Memory`,
                    mediaUris,
                    createdAt,
                });
            }
        });

        return Array.from(deduped.values());
    }

    private buildArchiveSignature(provider: 'INSTAGRAM' | 'FACEBOOK', post: ArchivePost): string {
        const base = [
            provider,
            post.id || '',
            post.content || '',
            post.createdAt ? new Date(post.createdAt).toISOString() : '',
            post.mediaUris?.[0] || '',
        ].join('|');

        return crypto.createHash('sha256').update(base).digest('hex').slice(0, 24);
    }

    private buildArchiveExternalId(provider: 'INSTAGRAM' | 'FACEBOOK', post: ArchivePost): string {
        const signature = post.id || this.buildArchiveSignature(provider, post);
        return `ARCHIVE_${provider}_${signature}`;
    }

    private extractArchiveCoverImage(archiveDir: string | null, mediaIndex: Map<string, string> | null, mediaUris: string[]): string | null {
        if (!archiveDir || !mediaUris || mediaUris.length === 0) return null;

        const mediaPath = this.findMediaFile(archiveDir, mediaIndex, mediaUris);
        if (!mediaPath) return null;

        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const ext = path.extname(mediaPath) || path.extname(mediaUris[0]) || '.jpg';
        const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        const filePath = path.join(uploadDir, filename);

        fs.copyFileSync(mediaPath, filePath);

        const baseUrl = this.getPublicBaseUrl();
        return baseUrl ? `${baseUrl}/uploads/${filename}` : `/uploads/${filename}`;
    }

    private safeJsonParse(content: string): any | null {
        try {
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    private extractZipToTemp(buffer: Buffer): { dir: string; cleanup: () => void } {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'notive-import-'));
        const zipPath = path.join(tempRoot, 'archive.zip');
        const extractDir = path.join(tempRoot, 'unzipped');
        fs.writeFileSync(zipPath, buffer);

        if (process.platform === 'win32') {
            const result = spawnSync('powershell', [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${extractDir}' -Force`,
            ], { windowsHide: true });

            if (result.status !== 0) {
                throw new Error('Failed to unzip archive. Please extract and upload the JSON files.');
            }
        } else {
            const result = spawnSync('unzip', ['-o', zipPath, '-d', extractDir]);
            if (result.status !== 0) {
                throw new Error('Failed to unzip archive. Please extract and upload the JSON files.');
            }
        }

        return {
            dir: extractDir,
            cleanup: () => {
                try {
                    fs.rmSync(tempRoot, { recursive: true, force: true });
                } catch {
                    // ignore cleanup errors
                }
            },
        };
    }

    private listJsonFiles(rootDir: string): string[] {
        const results: string[] = [];
        const stack = [rootDir];

        while (stack.length > 0) {
            const current = stack.pop()!;
            const entries = fs.readdirSync(current, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
                    results.push(fullPath);
                }
            }
        }

        return results;
    }

    private buildMediaIndex(rootDir: string): Map<string, string> {
        const index = new Map<string, string>();
        const stack = [rootDir];

        while (stack.length > 0) {
            const current = stack.pop()!;
            const entries = fs.readdirSync(current, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(current, entry.name);
                if (entry.isDirectory()) {
                    stack.push(fullPath);
                } else if (entry.isFile()) {
                    const base = entry.name.toLowerCase();
                    if (!index.has(base)) {
                        index.set(base, fullPath);
                    }
                }
            }
        }

        return index;
    }

    private findMediaFile(rootDir: string, mediaIndex: Map<string, string> | null, mediaUris: string[]): string | null {
        for (const uri of mediaUris) {
            if (!uri) continue;
            const normalized = uri.replace(/^\/+/, '');
            const directPath = path.join(rootDir, normalized);
            if (fs.existsSync(directPath)) return directPath;

            const base = path.basename(normalized).toLowerCase();
            if (mediaIndex && mediaIndex.has(base)) {
                return mediaIndex.get(base) || null;
            }
        }
        return null;
    }

    private coerceDate(value: any): Date | null {
        if (!value) return null;
        if (value instanceof Date) return value;

        if (typeof value === 'number') {
            return value > 100000000000 ? new Date(value) : new Date(value * 1000);
        }

        if (typeof value === 'string') {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) return parsed;

            const num = Number(value);
            if (!Number.isNaN(num)) {
                return num > 100000000000 ? new Date(num) : new Date(num * 1000);
            }
        }

        return null;
    }

    private looksLikeMediaPath(value: string): boolean {
        const lower = value.toLowerCase();
        return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.mp4') || lower.endsWith('.mov');
    }

    private getPublicBaseUrl(): string | null {
        const apiUrl = process.env.API_URL || 'http://localhost:8000/api/v1';
        if (!apiUrl) return null;
        return apiUrl.replace(/\/api\/v1\/?$/, '');
    }

    private normalizeClientOrigin(clientOrigin?: string): string | undefined {
        if (!clientOrigin || typeof clientOrigin !== 'string') {
            return undefined;
        }

        try {
            const parsed = new URL(clientOrigin.trim());
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return undefined;
            }
            return parsed.origin;
        } catch {
            return undefined;
        }
    }

    private buildRedirectUriFromApiBase(apiBaseUrl?: string): string | null {
        if (!apiBaseUrl || typeof apiBaseUrl !== 'string') return null;

        try {
            const parsed = new URL(apiBaseUrl.trim());
            const basePath = parsed.pathname.replace(/\/+$/, '');
            parsed.pathname = `${basePath}/import/callback`.replace(/\/{2,}/g, '/');
            parsed.search = '';
            parsed.hash = '';
            return parsed.toString().replace(/\/+$/, '');
        } catch {
            return null;
        }
    }

    private isLoopbackUrl(value: string): boolean {
        try {
            const parsed = new URL(value);
            return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
        } catch {
            return false;
        }
    }

    private getResolvedRedirectUri(provider: 'INSTAGRAM' | 'FACEBOOK', apiBaseUrl?: string): string | null {
        const explicit = provider === 'INSTAGRAM'
            ? this.INSTAGRAM_REDIRECT_URI
            : this.FACEBOOK_REDIRECT_URI;
        const apiBase = apiBaseUrl || process.env.API_URL || '';
        const derivedBase = this.buildRedirectUriFromApiBase(apiBase);
        const derived = derivedBase
            ? `${derivedBase}/${provider.toLowerCase()}`
            : null;

        if (!explicit && derived) {
            return derived;
        }

        if (explicit && derived && this.isLoopbackUrl(explicit) && !this.isLoopbackUrl(derived)) {
            return derived;
        }

        return explicit || derived;
    }

    private normalizeReturnTo(returnTo?: string): string {
        if (!returnTo || typeof returnTo !== 'string') {
            return '/profile';
        }

        const trimmed = returnTo.trim();
        if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
            return '/profile';
        }

        return trimmed;
    }

    private async resolveInstagramGraphAccount(accessToken: string): Promise<InstagramGraphAccount> {
        try {
            const response = await axios.get(`${this.getGraphBaseUrl()}/me/accounts`, {
                params: {
                    fields: 'id,name,instagram_business_account{id,username}',
                    access_token: accessToken,
                    limit: 50,
                },
            });

            const pages = Array.isArray(response.data?.data) ? response.data.data : [];
            for (const page of pages) {
                const igAccount = page?.instagram_business_account;
                if (igAccount?.id) {
                    return {
                        id: String(igAccount.id),
                        username: typeof igAccount.username === 'string' ? igAccount.username : null,
                    };
                }
            }

            throw new Error('No Instagram professional account linked to your Facebook Pages. Link Instagram Business/Creator to a Facebook Page and retry.');
        } catch (error) {
            throw this.toProviderError('Instagram', error);
        }
    }

    private async fetchProviderIdentity(
        provider: 'INSTAGRAM' | 'FACEBOOK',
        accessToken: string
    ): Promise<string | null> {
        try {
            if (provider === 'INSTAGRAM') {
                const account = await this.resolveInstagramGraphAccount(accessToken);
                return account.username || account.id;
            }

            const response = await axios.get(`${this.getGraphBaseUrl()}/me`, {
                params: {
                    fields: 'id,name',
                    access_token: accessToken,
                },
            });
            const id = typeof response.data?.id === 'string' ? response.data.id : '';
            const name = typeof response.data?.name === 'string' ? response.data.name : '';
            return id || name || null;
        } catch (error) {
            console.warn(`Failed to resolve ${provider} identity`, error);
            return null;
        }
    }

    private normalizeContent(content: string | null | undefined, fallback: string): string {
        const trimmed = (content || '').replace(/\s+/g, ' ').trim();
        return trimmed || fallback;
    }

    private normalizeDate(value: string | Date | null | undefined): Date {
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        if (typeof value === 'string') {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) return parsed;
        }
        return new Date();
    }

    private toParagraphHtml(content: string): string {
        const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\n/g, '<br/>');

        return `<p>${escaped}</p>`;
    }

    private buildEntryTitle(provider: 'INSTAGRAM' | 'FACEBOOK', content: string, createdAt: Date): string {
        const withoutHashtags = content.replace(/#\w+/g, ' ').replace(/\s+/g, ' ').trim();
        const base = withoutHashtags || `${provider === 'INSTAGRAM' ? 'Instagram' : 'Facebook'} memory`;
        const trimmed = base.slice(0, 90).trim();
        if (trimmed.length > 0) {
            return trimmed;
        }

        return `${provider === 'INSTAGRAM' ? 'Instagram' : 'Facebook'} Memory ${createdAt.toLocaleDateString()}`;
    }

    private buildImportTags(provider: 'INSTAGRAM' | 'FACEBOOK', content?: string): string[] {
        const base = provider === 'INSTAGRAM' ? 'instagram' : 'facebook';
        const fromHashtags = this.extractHashtags(content);
        return Array.from(new Set([base, 'imported', ...fromHashtags])).slice(0, 12);
    }

    private mapInstagramPostToEntryData(userId: string, post: InstagramPost): EntryImportCreateData {
        const createdAt = this.normalizeDate(post.timestamp);
        const content = this.normalizeContent(post.caption, 'Instagram memory');
        const tags = this.buildImportTags('INSTAGRAM', post.caption);

        return {
            userId,
            source: 'INSTAGRAM',
            externalId: post.id,
            sourceLink: post.permalink || null,
            title: this.buildEntryTitle('INSTAGRAM', content, createdAt),
            content,
            contentHtml: this.toParagraphHtml(content),
            mood: this.detectMood(content),
            tags,
            coverImage: post.media_url || null,
            category: 'PERSONAL',
            lifeArea: 'Life',
            createdAt,
            analysis: {
                import: {
                    provider: 'INSTAGRAM',
                    mode: 'oauth',
                    importedAt: new Date().toISOString(),
                    hasMedia: Boolean(post.media_url),
                },
            },
        };
    }

    private mapFacebookPostToEntryData(userId: string, post: FacebookPost): EntryImportCreateData {
        const createdAt = this.normalizeDate(post.created_time);
        const raw = post.message || post.story;
        const content = this.normalizeContent(raw, 'Facebook memory');
        const coverImage = post.full_picture || this.extractFacebookAttachmentImage(post.attachments);
        const tags = this.buildImportTags('FACEBOOK', content);

        return {
            userId,
            source: 'FACEBOOK',
            externalId: post.id,
            sourceLink: post.permalink_url || null,
            title: this.buildEntryTitle('FACEBOOK', content, createdAt),
            content,
            contentHtml: this.toParagraphHtml(content),
            mood: this.detectMood(content),
            tags,
            coverImage: coverImage || null,
            category: 'PERSONAL',
            lifeArea: 'Life',
            createdAt,
            analysis: {
                import: {
                    provider: 'FACEBOOK',
                    mode: 'oauth',
                    importedAt: new Date().toISOString(),
                    hasMedia: Boolean(coverImage),
                },
            },
        };
    }

    private extractFacebookAttachmentImage(attachments: unknown): string | null {
        const queue: unknown[] = [attachments];
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) continue;

            if (Array.isArray(item)) {
                queue.push(...item);
                continue;
            }

            if (typeof item !== 'object') continue;
            const record = item as Record<string, unknown>;
            const media = record.media as Record<string, unknown> | undefined;
            const image = media?.image as Record<string, unknown> | undefined;
            if (typeof image?.src === 'string') {
                return image.src;
            }

            if (typeof record.url === 'string' && /\.(jpg|jpeg|png|webp|gif)$/i.test(record.url)) {
                return record.url;
            }

            Object.values(record).forEach((value) => queue.push(value));
        }

        return null;
    }

    private toProviderError(provider: 'Instagram' | 'Facebook', error: unknown): Error {
        if (axios.isAxiosError(error)) {
            const responseMessage = error.response?.data?.error?.message
                || error.response?.data?.message
                || error.message;
            return new Error(`${provider} API error: ${responseMessage}`);
        }
        return new Error(`${provider} API error`);
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
    private encodeState(data: OAuthStateInput): string {
        const issuedAt = Date.now();
        const payload: OAuthStateData = {
            ...data,
            nonce: crypto.randomUUID(),
            issuedAt,
            expiresAt: issuedAt + this.OAUTH_STATE_TTL_MS,
        };
        const encodedPayload = this.toBase64Url(JSON.stringify(payload));
        const signature = this.signState(encodedPayload);
        return `${encodedPayload}.${signature}`;
    }

    /**
     * Decode and verify OAuth state
     */
    decodeState(state: string): OAuthStateData | null {
        try {
            const [encodedPayload, providedSignature, ...rest] = state.split('.');
            if (!encodedPayload || !providedSignature || rest.length > 0) {
                return null;
            }

            const expectedSignature = this.signState(encodedPayload);
            if (!this.signaturesMatch(providedSignature, expectedSignature)) {
                return null;
            }

            const decoded = JSON.parse(this.fromBase64Url(encodedPayload)) as Partial<OAuthStateData>;
            if (!decoded || typeof decoded.userId !== 'string' || decoded.userId.trim() === '') {
                return null;
            }
            if (decoded.platform !== 'instagram' && decoded.platform !== 'facebook') {
                return null;
            }
            if (typeof decoded.returnTo !== 'string') {
                return null;
            }
            if (decoded.clientOrigin !== undefined && this.normalizeClientOrigin(decoded.clientOrigin) === undefined) {
                return null;
            }
            if (typeof decoded.nonce !== 'string' || decoded.nonce.length < 8) {
                return null;
            }
            if (typeof decoded.issuedAt !== 'number' || !Number.isFinite(decoded.issuedAt)) {
                return null;
            }
            if (typeof decoded.expiresAt !== 'number' || !Number.isFinite(decoded.expiresAt)) {
                return null;
            }

            const now = Date.now();
            if (decoded.expiresAt < now) {
                return null;
            }
            if (decoded.issuedAt > now + 60_000) {
                return null;
            }
            if (decoded.expiresAt - decoded.issuedAt > this.OAUTH_STATE_TTL_MS + 60_000) {
                return null;
            }

            return {
                userId: decoded.userId,
                platform: decoded.platform,
                returnTo: decoded.returnTo,
                clientOrigin: this.normalizeClientOrigin(decoded.clientOrigin),
                nonce: decoded.nonce,
                issuedAt: decoded.issuedAt,
                expiresAt: decoded.expiresAt,
            };
        } catch {
            return null;
        }
    }

    private signState(encodedPayload: string): string {
        const signature = crypto
            .createHmac('sha256', this.getOAuthStateSecret())
            .update(encodedPayload)
            .digest('base64');
        return signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    private signaturesMatch(providedSignature: string, expectedSignature: string): boolean {
        const providedBuffer = Buffer.from(providedSignature);
        const expectedBuffer = Buffer.from(expectedSignature);
        if (providedBuffer.length !== expectedBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
    }

    private getOAuthStateSecret(): string {
        if (!this.OAUTH_STATE_SECRET) {
            throw new Error('OAUTH_STATE_SECRET must be configured for social OAuth callbacks.');
        }
        return this.OAUTH_STATE_SECRET;
    }

    private toBase64Url(value: string): string {
        return Buffer.from(value, 'utf8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
    }

    private encodeBase64UrlBuffer(value: Buffer): string {
        return value
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
    }

    private decodeBase64UrlBuffer(value: string): Buffer {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padding = normalized.length % 4 === 0
            ? ''
            : '='.repeat(4 - (normalized.length % 4));
        return Buffer.from(`${normalized}${padding}`, 'base64');
    }

    private fromBase64Url(value: string): string {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padding = normalized.length % 4 === 0
            ? ''
            : '='.repeat(4 - (normalized.length % 4));
        return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
    }

    private getSocialTokenEncryptionKey(): Buffer {
        if (!this.SOCIAL_TOKEN_ENCRYPTION_SECRET) {
            throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY must be configured for social imports.');
        }

        return crypto
            .createHash('sha256')
            .update(this.SOCIAL_TOKEN_ENCRYPTION_SECRET, 'utf8')
            .digest();
    }

    private encryptSocialAccessToken(accessToken: string): string {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.getSocialTokenEncryptionKey(), iv);
        const ciphertext = Buffer.concat([cipher.update(accessToken, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();

        return [
            SOCIAL_TOKEN_ENCRYPTION_PREFIX,
            this.encodeBase64UrlBuffer(iv),
            this.encodeBase64UrlBuffer(authTag),
            this.encodeBase64UrlBuffer(ciphertext),
        ].join(':');
    }

    private decryptSocialAccessToken(storedValue: string): string {
        if (!storedValue.startsWith(`${SOCIAL_TOKEN_ENCRYPTION_PREFIX}:`)) {
            // Backward compatibility for pre-encryption rows.
            return storedValue;
        }

        const payload = storedValue.slice(`${SOCIAL_TOKEN_ENCRYPTION_PREFIX}:`.length);
        const parts = payload.split(':');
        if (parts.length !== 3) {
            throw new Error('Stored social token is malformed.');
        }

        const iv = this.decodeBase64UrlBuffer(parts[0]);
        const authTag = this.decodeBase64UrlBuffer(parts[1]);
        const ciphertext = this.decodeBase64UrlBuffer(parts[2]);

        const decipher = crypto.createDecipheriv('aes-256-gcm', this.getSocialTokenEncryptionKey(), iv);
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return plaintext.toString('utf8');
    }

    /**
     * Delay helper for rate limiting
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private chunkArray<T>(items: T[], chunkSize = 200): T[][] {
        const result: T[][] = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            result.push(items.slice(i, i + chunkSize));
        }
        return result;
    }

    private async fetchExistingExternalIds(
        userId: string,
        provider: 'INSTAGRAM' | 'FACEBOOK',
        externalIds: string[]
    ): Promise<Set<string>> {
        const uniqueExternalIds = Array.from(new Set(externalIds.filter(Boolean)));
        if (uniqueExternalIds.length === 0) return new Set<string>();

        const existing = new Set<string>();
        const chunks = this.chunkArray(uniqueExternalIds, 200);

        for (const chunk of chunks) {
            const rows = await prisma.entry.findMany({
                where: {
                    userId,
                    source: provider,
                    externalId: { in: chunk },
                },
                select: { externalId: true },
            });

            rows.forEach((row: (typeof rows)[number]) => {
                if (row.externalId) {
                    existing.add(row.externalId);
                }
            });
        }

        return existing;
    }
}

export default new SocialImportService();
