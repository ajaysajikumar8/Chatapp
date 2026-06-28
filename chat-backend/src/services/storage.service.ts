import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

// Initialize the S3 client configured for Cloudflare R2
const s3Client = accountId && accessKeyId && secretAccessKey ? new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
}) : null;

/**
 * Generates a presigned URL for the client to directly upload a file to Cloudflare R2.
 */
export const generatePresignedUploadUrl = async (conversationId: string, fileName: string, mimeType: string, fileSize?: number): Promise<{ uploadUrl: string, fileKey: string }> => {
    if (!s3Client || !bucketName) {
        throw new Error("R2 is not configured properly.");
    }

    // Organize inside conversations folder structure
    const fileKey = `conversations/${conversationId}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${fileName}`;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        ContentType: mimeType,
        ...(fileSize !== undefined ? { ContentLength: fileSize } : {}),
    });

    // The URL is valid for 15 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return { uploadUrl, fileKey };
};

/**
 * Generates a presigned URL for the client to view/download a file securely.
 */
export const generatePresignedDownloadUrl = async (fileKey: string): Promise<string> => {
    if (!s3Client || !bucketName) {
        return fileKey; // Fallback or throw error depending on requirements
    }

    // Extract original filename from key: conversations/id/timestamp-random-filename
    const parts = fileKey.split('/');
    const lastPart = parts[parts.length - 1] || '';
    const subParts = lastPart.split('-');
    const originalFileName = (subParts.length > 2 ? subParts.slice(2).join('-') : lastPart) || '';

    // Detect if file is safe to render inline (images, videos, audio)
    const inlineExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'ogg', 'mp3', 'wav'];
    const ext = originalFileName.split('.').pop()?.toLowerCase() || '';
    const isInlineable = inlineExtensions.includes(ext);

    const cleanFileName = originalFileName.replace(/"/g, '\\"');
    const contentDisposition = isInlineable 
        ? 'inline' 
        : `attachment; filename="${cleanFileName}"`;

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        ResponseContentDisposition: contentDisposition,
    });

    // The read URL is valid for 5 minutes (300 seconds) for strict production security
    return await getSignedUrl(s3Client, command, { expiresIn: 300 });
};

/**
 * Generates a presigned URL for the client to directly upload their profile photo to Cloudflare R2.
 */
export const generatePresignedAvatarUploadUrl = async (userId: string, extension: string, mimeType: string, fileSize?: number): Promise<{ uploadUrl: string, fileKey: string }> => {
    if (!s3Client || !bucketName) {
        throw new Error("R2 is not configured properly.");
    }

    const fileKey = `users/${userId}/avatars/avatar-${Date.now()}.${extension}`;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        ContentType: mimeType,
        ...(fileSize !== undefined ? { ContentLength: fileSize } : {}),
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return { uploadUrl, fileKey };
};

/**
 * Deletes a file from Cloudflare R2 given its key.
 */
export const deleteFileFromR2 = async (fileKey: string): Promise<void> => {
    if (!s3Client || !bucketName) {
        return;
    }
    try {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
        });
        await s3Client.send(command);
    } catch (err) {
        console.error(`Failed to delete file from R2 for key: ${fileKey}`, err);
    }
};
