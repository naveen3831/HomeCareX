export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_OUTPUT_SIZE = 512;

/** null when the file is acceptable, otherwise the message to show the customer. */
export function validateAvatarFile(file: Pick<File, "type" | "size" | "name">): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return "Use a JPG, PNG or WebP image.";
  if (file.size > AVATAR_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `That image is ${mb} MB. Choose one that's 2 MB or smaller.`;
  }
  if (file.size === 0) return "That file is empty.";
  return null;
}

export interface CropState {
  /** 1 = the image just covers the square; up to 3 = zoomed in. */
  zoom: number;
  /** -1..1: where the visible window sits on the image (0 = centred). */
  offsetX: number;
  offsetY: number;
}

/** Where to draw the image on a `size`×`size` canvas so the visible square matches the crop state. */
export function cropRect(imgW: number, imgH: number, size: number, { zoom, offsetX, offsetY }: CropState) {
  const scale = Math.max(size / imgW, size / imgH) * Math.max(1, zoom);
  const w = imgW * scale;
  const h = imgH * scale;
  const clamp = (n: number) => Math.min(1, Math.max(-1, n));
  return {
    x: (size - w) / 2 - clamp(offsetX) * ((w - size) / 2),
    y: (size - h) / 2 - clamp(offsetY) * ((h - size) / 2),
    w,
    h,
  };
}

export function drawCrop(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, size: number, state: CropState) {
  const r = cropRect(img.width, img.height, size, state);
  ctx.fillStyle = "#ffffff"; // transparent PNGs become white, not black, in the JPEG
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
}

export function loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("We couldn't read that image. Try another one."));
    };
    img.src = url;
  });
}

/** The cropped square as a JPEG blob (well under the 2 MB limit at 512 px). */
export function cropToBlob(img: HTMLImageElement, state: CropState, size = AVATAR_OUTPUT_SIZE): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Your browser can't process images."));
  drawCrop(ctx, img, size, state);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't prepare the photo."))), "image/jpeg", 0.9),
  );
}
