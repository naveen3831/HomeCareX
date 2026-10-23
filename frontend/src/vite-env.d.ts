/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "false" switches pricing/coupons from services/pricing.mock.ts to the real endpoints. */
  readonly VITE_MOCK_PRICING?: string;
  /** Google Maps key (Maps JavaScript, Geocoding and Places API (New) enabled). */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

declare module 'jspdf' {
  export class jsPDF {
    constructor(options?: Record<string, unknown>);
    addFileToVFS(filename: string, filecontent: string): void;
    addFont(filename: string, fontname: string, fontstyle: string): void;
    setFont(fontName: string, fontStyle?: string): void;
    setFontSize(size: number): void;
    setTextColor(r: number, g?: number, b?: number): void;
    setDrawColor(r: number, g?: number, b?: number): void;
    setFillColor(r: number, g?: number, b?: number): void;
    text(text: string | string[], x: number, y: number, options?: Record<string, unknown>): void;
    line(x1: number, y1: number, x2: number, y2: number): void;
    rect(x: number, y: number, w: number, h: number, style?: string): void;
    roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string): void;
    setLineWidth(width: number): void;
    addPage(): void;
    getTextWidth(text: string): number;
    splitTextToSize(text: string, maxW: number): string[];
    addImage(imageData: string | HTMLImageElement | HTMLCanvasElement, format: string, x: number, y: number, width: number, height: number): void;
    save(filename: string): void;
    output(type?: string): string | ArrayBuffer | Blob;
  }
}