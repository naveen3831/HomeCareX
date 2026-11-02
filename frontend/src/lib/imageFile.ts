export function fileToDataUrl(file: File, maxEdge = 900, quality = 0.82, maxChars = 250_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let edge = maxEdge;
      let q = quality;
      for (let i = 0; i < 8; i++) {
        const scale = Math.min(1, edge / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL('image/jpeg', q);
        if (out.length <= maxChars) return resolve(out);
        q = Math.max(0.5, q - 0.1);
        edge = Math.round(edge * 0.85);
      }
      reject(new Error(`${file.name}: image is too large, use a smaller one`));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read ${file.name}`)); };
    img.src = url;
  });
}
/** Natural width/height of an image File, or rejects when the browser cannot decode it (corrupt, wrong type). */
export function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.width, height: img.height }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name}: not a valid image`)); };
    img.src = url;
  });
}
