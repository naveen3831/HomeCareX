import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'ddgjubbbx',
  api_key: process.env.CLOUDINARY_API_KEY || '813678481714894',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'bUvTx6YXqMiSIHiLhcIt_XIMn5Q',
  secure: true,
});

export const cloudinaryClient = cloudinary;
export default cloudinary;

