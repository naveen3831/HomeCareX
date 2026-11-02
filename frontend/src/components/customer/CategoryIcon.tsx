import { useState } from "react";
import clsx from "clsx";
import Icon3D from "./Icon3D";

interface CategoryIconProps {
  /** Icon image the admin uploaded for the category. Shown when present and it loads. */
  iconUrl?: string | null;
  /** Used for the built-in 3D icon when there is no uploaded icon (emoji, name, slug). */
  hints: (string | null | undefined)[];
  size?: number;
  float?: boolean;
  delay?: number;
  className?: string;
}

/**
 * A category's icon: the image the admin uploaded in Categories, otherwise the built-in 3D icon
 * picked from the emoji / name / slug. A broken upload falls back to the 3D icon instead of a broken image.
 */
export default function CategoryIcon({ iconUrl, hints, size = 56, float = true, delay = 0, className }: CategoryIconProps) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const url = iconUrl?.trim();

  if (url && url !== failedUrl) {
    return (
      <span
        aria-hidden="true"
        className={clsx("icon3d-wrap inline-flex shrink-0", float && "icon3d--float", className)}
        style={{ width: size, height: size, animationDelay: `${delay}s` }}
      >
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedUrl(url)}
          className="icon3d h-full w-full object-contain"
        />
      </span>
    );
  }
  return <Icon3D hints={hints} size={size} float={float} delay={delay} className={className} />;
}
