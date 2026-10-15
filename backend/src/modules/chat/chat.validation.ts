import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const MAX_TEXT = 1000;
export const MAX_ATTACHMENTS = 4;
/** Longest accepted attachment, in characters. Keep in step with MAX_PHOTO_CHARS in ChatPanel. */
export const MAX_ATTACHMENT_CHARS = 220_000;

export const bookingParamsSchema = z.object({ id: objectId }).strict();

export const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(30),
    /** Cursor: id of the oldest message already loaded; returns messages older than it. */
    before: objectId.optional(),
  })
  .strict();

/** An https image URL, or a small compressed image data URL (what ChatPanel sends today). */
const attachmentSchema = z
  .object({
    url: z
      .string()
      .max(MAX_ATTACHMENT_CHARS)
      .refine(
        (u) =>
          u.startsWith("https://") ||
          /^data:image\/(jpeg|png|webp);base64,/.test(u),
        "Attachment must be an https URL or a JPG/PNG/WebP image",
      ),
    kind: z.literal("image").default("image"),
  })
  .strict();

export const sendBodySchema = z
  .object({
    text: z
      .string()
      .trim()
      .max(MAX_TEXT, `Message must be at most ${MAX_TEXT} characters`)
      .optional(),
    attachments: z
      .array(attachmentSchema)
      .max(MAX_ATTACHMENTS, `At most ${MAX_ATTACHMENTS} attachments`)
      .optional(),
  })
  .strict()
  .refine((b) => !!b.text || (b.attachments?.length ?? 0) > 0, {
    message: "text or attachments is required",
    path: ["text"],
  });

export type ListQuery = z.infer<typeof listQuerySchema>;
export type SendBody = z.infer<typeof sendBodySchema>;
