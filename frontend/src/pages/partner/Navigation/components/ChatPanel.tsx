export const MAX_PHOTOS = 4;

export function validatePhotos(
  existing: File[],
  incoming: File[],
): { files: File[]; problems: string[] } {
  const files = [...existing];
  const problems: string[] = [];
  let limitReported = false;

  incoming.forEach((file) => {
    if (file.type === "image/svg+xml") {
      problems.push("SVG uploads are not supported.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      problems.push(`${file.name} is not a supported image.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      problems.push(`${file.name} is too large.`);
      return;
    }
    if (files.length >= MAX_PHOTOS) {
      if (!limitReported) {
        problems.push(`You can attach up to ${MAX_PHOTOS} photos.`);
        limitReported = true;
      }
      return;
    }
    files.push(file);
  });

  return { files, problems };
}

export default function ChatPanel() {
  return <div className="chat-panel">Chat</div>;
}
