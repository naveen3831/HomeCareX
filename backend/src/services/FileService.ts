import { CloudinaryService, CloudinaryUploadResult } from './cloudinary.service';

export class FileService {
  static async uploadImage(source: string | Buffer, folder = 'homecarex/images'): Promise<CloudinaryUploadResult> {
    return CloudinaryService.uploadImage(source, folder);
  }

  static async uploadDocument(source: string | Buffer, folder = 'homecarex/documents'): Promise<CloudinaryUploadResult> {
    return CloudinaryService.uploadDocument(source, folder);
  }

  static async deleteFile(publicId: string): Promise<void> {
    return CloudinaryService.deleteAsset(publicId);
  }
}

export default FileService;
