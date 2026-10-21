
import type { ImgHTMLAttributes } from "react";

interface OptimizedImageProps
  extends Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    "src" | "alt" | "width" | "height" | "loading" | "fetchPriority"
  > {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  ...rest
}: OptimizedImageProps) {
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
