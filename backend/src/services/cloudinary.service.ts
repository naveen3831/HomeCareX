import { UploadApiResponse, UploadApiOptions } from 'cloudinary';
import { cloudinaryClient } from '../integrations/cloudinary';

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export class CloudinaryService {
  /**
   * Check whether Cloudinary has valid credentials configured.
   */
  static isConfigured(): boolean {
    const config = cloudinaryClient.config();
    return Boolean(config.cloud_name && config.api_key && config.api_secret);
  }

  /**
   * Upload an image (base64 data URL, file path, or Buffer) to Cloudinary.
   */
  static async uploadImage(
    source: string | Buffer,
    folder = 'homecarex/images',
    options: UploadApiOptions = {}
  ): Promise<CloudinaryUploadResult> {
    let payload: string;

    if (Buffer.isBuffer(source)) {
      payload = `data:image/png;base64,${source.toString('base64')}`;
    } else {
      payload = source;
    }

    const uploadOptions: UploadApiOptions = {
      folder,
      resource_type: 'image',
      overwrite: true,
      ...options,
    };

    const res: UploadApiResponse = await cloudinaryClient.uploader.upload(payload, uploadOptions);

    return {
      url: res.url,
      secureUrl: res.secure_url,
      publicId: res.public_id,
      format: res.format,
      width: res.width,
      height: res.height,
      bytes: res.bytes,
    };
  }

  /**
   * Upload a raw/document file (e.g. PDF or proof) to Cloudinary.
   */
  static async uploadDocument(
    source: string | Buffer,
    folder = 'homecarex/documents',
    options: UploadApiOptions = {}
  ): Promise<CloudinaryUploadResult> {
    let payload: string;

    if (Buffer.isBuffer(source)) {
      payload = `data:application/octet-stream;base64,${source.toString('base64')}`;
    } else {
      payload = source;
    }

    const uploadOptions: UploadApiOptions = {
      folder,
      resource_type: 'auto',
      overwrite: true,
      ...options,
    };

    const res: UploadApiResponse = await cloudinaryClient.uploader.upload(payload, uploadOptions);

    return {
      url: res.url,
      secureUrl: res.secure_url,
      publicId: res.public_id,
      format: res.format,
      bytes: res.bytes,
    };
  }

  /**
   * Delete an asset from Cloudinary by public ID.
   */
  static async deleteAsset(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'image'): Promise<void> {
    try {
      await cloudinaryClient.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
      console.warn(`[cloudinary] failed to delete asset ${publicId}:`, err);
    }
  }
}

