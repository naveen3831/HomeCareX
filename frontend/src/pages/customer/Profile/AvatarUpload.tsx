import { useEffect, useId, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import clsx from "clsx";
import { describeError, useRemoveAvatar, useUploadAvatar, type ProfileDto } from "@/features/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cropToBlob, drawCrop, loadImage, validateAvatarFile, type CropState } from "@/lib/avatarCrop";
import { FormMessage, OFFLINE_NOTE, PRIMARY_BUTTON, SECONDARY_BUTTON, Spinner } from "./formKit";
import { initialsOf } from "./ProfileHero";

const PREVIEW = 224;
const START: CropState = { zoom: 1, offsetX: 0, offsetY: 0 };

/** Profile photo: pick a JPG / PNG / WebP (max 2 MB), frame it in a circle, then upload the cropped square. */
export default function AvatarUpload({ profile }: { profile: ProfileDto }) {
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const online = useOnlineStatus();
  const inputId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [picked, setPicked] = useState<{ img: HTMLImageElement; url: string } | null>(null);
  const [crop, setCrop] = useState<CropState>(START);
  const [error, setError] = useState<string | null>(null);

  // Live preview: draws with the same function that produces the uploaded image, so what you see is what you get.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (picked && ctx) drawCrop(ctx, picked.img, PREVIEW, crop);
  }, [picked, crop]);

  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);

  const close = () => {
    setPicked(null);
    setCrop(START);
  };

  const onPick = async (file: File | undefined, input: HTMLInputElement) => {
    input.value = ""; // so choosing the same file again still fires
    if (!file) return;
    setError(null);
    const problem = validateAvatarFile(file);
    if (problem) return setError(problem);
    try {
      setPicked(await loadImage(file));
      setCrop(START);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't read that image.");
    }
  };

  const onUpload = async () => {
    if (!picked || !online) return;
    setError(null);
    try {
      const blob = await cropToBlob(picked.img, crop);
      upload.mutate(blob, {
        onSuccess: close,
        onError: (err) => setError(describeError(err).fields.avatar ?? describeError(err).form ?? "Couldn't upload the photo."),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't prepare the photo.");
    }
  };

  const onRemove = () => {
    setError(null);
    remove.mutate(undefined, { onError: (err) => setError(describeError(err).form ?? "Couldn't remove the photo.") });
  };

  const busy = upload.isPending || remove.isPending;
  const slider = (key: keyof CropState, label: string, min: number, max: number, step: number) => (
    <label className="block text-xs font-semibold text-muted">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={crop[key]}
        disabled={upload.isPending}
        onChange={(e) => setCrop((c) => ({ ...c, [key]: Number(e.target.value) }))}
        className={clsx("mt-1 block w-full accent-brand", FOCUS_RING)}
      />
    </label>
  );

  return (
    <div className="mb-5 border-b border-line/70 pb-5">
      <div className="flex items-center gap-4">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="Your profile photo" className="h-20 w-20 shrink-0 rounded-full border-[3px] border-white object-cover shadow-md" />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-brand text-2xl font-bold text-white shadow-md" role="img" aria-label="No profile photo yet">
            {initialsOf(profile.name)}
          </span>
        )}
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-ink">Profile photo</p>
          <p className="text-xs text-muted">JPG, PNG or WebP, up to 2 MB.</p>
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className={clsx(SECONDARY_BUTTON, "min-h-[44px] cursor-pointer px-4", (busy || !!picked) && "pointer-events-none opacity-50", "focus-within:ring-2 focus-within:ring-brand")}
            >
              <Camera className="h-4 w-4" aria-hidden="true" /> {profile.avatarUrl ? "Change photo" : "Add photo"}
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy || !!picked}
              onChange={(e) => void onPick(e.target.files?.[0], e.target)}
            />
            {profile.avatarUrl && !picked && (
              <button type="button" onClick={onRemove} disabled={busy} className={clsx(SECONDARY_BUTTON, "min-h-[44px] px-4 text-danger")}>
                {remove.isPending ? <>Removing…</> : <><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {picked && (
        <div role="group" aria-label="Adjust your photo" className="mt-4 rounded-2xl border border-line bg-canvas p-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative shrink-0" style={{ width: PREVIEW, height: PREVIEW, maxWidth: "100%" }}>
              <canvas ref={canvasRef} width={PREVIEW} height={PREVIEW} className="h-full w-full rounded-full border border-line" aria-label="Photo preview" role="img" />
            </div>
            <div className="w-full flex-1 space-y-3">
              {slider("zoom", "Zoom", 1, 3, 0.05)}
              {slider("offsetX", "Move left / right", -1, 1, 0.05)}
              {slider("offsetY", "Move up / down", -1, 1, 0.05)}
            </div>
          </div>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} disabled={upload.isPending} className={SECONDARY_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={() => void onUpload()} disabled={upload.isPending || !online} className={PRIMARY_BUTTON}>
              {upload.isPending ? <><Spinner /> Uploading…</> : "Use this photo"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {error && <FormMessage kind="error">{error}</FormMessage>}
        {!online && <FormMessage kind="info">{OFFLINE_NOTE}</FormMessage>}
      </div>
    </div>
  );
}
