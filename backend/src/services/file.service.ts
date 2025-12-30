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
        // Deletion not strictly required for MVP upload flow, implemented as no-op or TODO
        cb(null);
    }

    private async uploadToS3(file: Express.Multer.File, key: string): Promise<string> {
        const { bucket, region, accessKeyId, secretAccessKey } = this.options;
        const host = `${bucket}.s3.${region}.amazonaws.com`;
        const url = `https://${host}/${key}`;
        const date = new Date();
        const amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
        const dateStamp = amzDate.slice(0, 8); // YYYYMMDD

        // capture stream to buffer (simple for MVP small files)
        const buffer = await this.streamToBuffer(file.stream);
        const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');

        // 1. Canonical Request
        const method = 'PUT';
        const canonicalUri = `/${key}`;
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

        return url;
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
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    })
    : localStorage;

// File filter (Allowed: images and audio)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(null, false); // Fail silently or pass error
    }
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit (increased for audio)
    },
});

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
