import { Router, Request, Response } from 'express';
import multer from 'multer';
import { CloudinaryService } from '../services/cloudinary.service';
import { authMiddleware } from '../middleware/auth.middleware';

export const uploadRoutes = Router();

// Keep uploads in memory so they can be streamed directly to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * Upload an image to Cloudinary.
 * Accepts either:
 *  - multipart/form-data with field name "file" or "image"
 *  - JSON body with { image: "data:image/...;base64,..." } or { dataUrl: "..." }
 */
uploadRoutes.post(
  '/image',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!CloudinaryService.isConfigured()) {
        res.status(503).json({
          success: false,
          message: 'Cloudinary storage is not configured.',
          code: 'STORAGE_UNAVAILABLE',
        });
        return;
      }

      let source: Buffer | string | undefined;

      if (req.file) {
        source = req.file.buffer;
      } else if (req.body?.image) {
        source = req.body.image;
      } else if (req.body?.dataUrl) {
        source = req.body.dataUrl;
      }

      if (!source) {
        res.status(400).json({
          success: false,
          message: 'No image provided. Send a file or base64 dataUrl.',
          code: 'IMAGE_REQUIRED',
        });
        return;
      }

      const folder = (req.body?.folder as string) || 'homecarex/uploads';
      const result = await CloudinaryService.uploadImage(source, folder);

      res.status(200).json({
        success: true,
        data: {
          url: result.secureUrl,
          publicId: result.publicId,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
        },
      });
    } catch (err: unknown) {
      console.error('[upload] Cloudinary upload error:', err);
      res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Upload failed',
        code: 'UPLOAD_FAILED',
      });
    }
  }
);

export default uploadRoutes;

