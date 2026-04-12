import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import crypto from 'crypto';
import axios from 'axios';

// --- S3 Storage Engine Implementation (No AWS SDK) ---

interface S3StorageOptions {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string; // Custom endpoint for R2/MinIO
}

class S3StorageEngine implements multer.StorageEngine {
    private options: S3StorageOptions;

    constructor(options: S3StorageOptions) {
        this.options = options;
    }

    _handleFile(req: Request, file: Express.Multer.File, cb: (error?: any, info?: Partial<Express.Multer.File>) => void): void {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = uniqueSuffix + path.extname(file.originalname);
        const key = `uploads/${filename}`;

        this.uploadToS3(file, key)
            .then(location => {
                cb(null, {
                    path: location,
                    filename: filename
                });
            })
            .catch(err => {
                cb(err);
            });
    }

    _removeFile(req: Request, file: Express.Multer.File, cb: (error: Error | null) => void): void {
        if (file.path) {
            const key = this.extractKeyFromUrl(file.path);
            if (key) {
                this.deleteFromS3(key).then(() => cb(null)).catch((err) => cb(err));
                return;
            }
        }
        cb(null);
    }

    private async uploadToS3(file: Express.Multer.File, key: string): Promise<string> {
        const { bucket, region, accessKeyId, secretAccessKey, endpoint } = this.options;
        // R2: endpoint = https://<account-id>.r2.cloudflarestorage.com
        // S3: default bucket-style host
        const host = endpoint
            ? `${new URL(endpoint).host}`
            : `${bucket}.s3.${region}.amazonaws.com`;
        const basePath = endpoint ? `/${bucket}/${key}` : `/${key}`;
        const url = `https://${host}${basePath}`;
        const date = new Date();
        const amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
        const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

        // capture stream to buffer (simple for MVP small files)
        const buffer = await this.streamToBuffer(file.stream);
        const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');

        // 1. Canonical Request
        const method = 'PUT';
        const canonicalUri = basePath;
        const canonicalQuerystring = '';
        const canonicalHeaders =
            `host:${host}\n` +
            `x-amz-content-sha256:${payloadHash}\n` +
            `x-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

        // 2. String to Sign
        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

        // 3. Signing Key
        const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
        const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
        const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
        const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

        // 4. Signature
        const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

        // 5. Authorization Header
        const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        // Upload using axios
        await axios.put(url, buffer, {
            headers: {
                'Content-Type': file.mimetype,
                'x-amz-date': amzDate,
                'x-amz-content-sha256': payloadHash,
                'Authorization': authorization
            }
        });

        // Return the public URL if R2 public domain is set, otherwise the S3 URL
        const publicDomain = process.env.R2_PUBLIC_DOMAIN;
        if (publicDomain) {
            return `https://${publicDomain}/${key}`;
        }
        return url;
    }

    async deleteFromS3(key: string): Promise<void> {
        const { bucket, region, accessKeyId, secretAccessKey, endpoint } = this.options;
        const host = endpoint
            ? `${new URL(endpoint).host}`
            : `${bucket}.s3.${region}.amazonaws.com`;
        const basePath = endpoint ? `/${bucket}/${key}` : `/${key}`;
        const url = `https://${host}${basePath}`;
        const date = new Date();
        const amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const dateStamp = amzDate.slice(0, 8);

        const payloadHash = crypto.createHash('sha256').update('').digest('hex');

        const method = 'DELETE';
        const canonicalHeaders =
            `host:${host}\n` +
            `x-amz-content-sha256:${payloadHash}\n` +
            `x-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        const canonicalRequest = `${method}\n${basePath}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

        const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
        const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
        const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
        const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

        const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
        const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        await axios.delete(url, {
            headers: {
                'x-amz-date': amzDate,
                'x-amz-content-sha256': payloadHash,
                'Authorization': authorization,
            },
        });
    }

    extractKeyFromUrl(url: string): string | null {
        // Match uploads/<filename> from the URL
        const match = url.match(/(uploads\/[^?#]+)/);
        return match ? match[1] : null;
    }

    private streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: any[] = [];
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
    }
}


// --- Local Storage Fallback ---

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});


// --- Config & Export ---

const isS3Configured = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_BUCKET_NAME;

const storage = isS3Configured
    ? new S3StorageEngine({
        bucket: process.env.AWS_BUCKET_NAME!,
        region: process.env.AWS_REGION || 'auto',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        endpoint: process.env.S3_ENDPOINT, // e.g. https://<account-id>.r2.cloudflarestorage.com
    })
    : localStorage;

// File filter (Allowed: images and audio)
export const allowedUploadMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/mp4',
];

export const DEFAULT_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = allowedUploadMimeTypes;
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(null, false); // Fail silently or pass error
    }
};

export const createUpload = (fileSize = DEFAULT_UPLOAD_LIMIT_BYTES) => multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize,
    },
});

export const upload = createUpload();

export class LocalFileService {
    static getFileUrl(req: Request, filename: string): string {
        if (filename.startsWith('http')) return filename; // Already full URL (S3)

        const protocol = req.protocol;
        const host = req.get('host');
        // Handle case where filename might be just the basename or relative path
        const basename = path.basename(filename);
        return `${protocol}://${host}/uploads/${basename}`;
    }
}

/**
 * Delete a previously uploaded file by URL.
 * Swallows errors — cleanup should never block entry operations.
 */
export async function deleteFile(fileUrl: string): Promise<void> {
    try {
        if (!fileUrl) return;

        if (isS3Configured && storage instanceof S3StorageEngine) {
            const key = storage.extractKeyFromUrl(fileUrl);
            if (key) {
                await storage.deleteFromS3(key);
            }
        } else {
            // Local disk: extract basename and unlink
            const basename = path.basename(fileUrl);
            const filePath = path.join(uploadDir, basename);
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
        }
    } catch (err) {
        console.error(`[File cleanup] Failed to delete ${fileUrl}:`, err);
    }
}
