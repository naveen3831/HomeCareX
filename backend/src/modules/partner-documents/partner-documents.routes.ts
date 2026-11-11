import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/response";
import PartnerModel from "../../models/Partner";
import { kycDocumentExists, readKycDocument, saveKycDocument } from "../partners/kyc-storage";

/**
 * Mounted at /partner/documents. A partner can list and open their OWN KYC documents
 * (the ID and address proof uploaded at registration). Admin review stays on the admin routes.
 * Not behind requireTrainingApproved on purpose: documents are part of KYC, not of the work area.
 */
export const partnerDocumentsRoutes = Router();

/** Old records may hold an external link instead of a stored file. Only public http(s) hosts, max 10 MB, 10 s. */
async function fetchLegacyUrl(raw: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const privateHost =
      host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/.test(host);
    if (!/^https?:$/.test(u.protocol) || privateHost) return null;
    const r = await fetch(u, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const buffer = Buffer.from(await r.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) return null;
    return { buffer, contentType: r.headers.get("content-type") ?? "application/octet-stream" };
  } catch {
    return null;
  }
}


const base = [authenticate, requireRole("partner")];

// GET /api/v1/partner/documents
partnerDocumentsRoutes.get(
  "/",
  ...base,
  asyncHandler(async (_req, res) => {
    const { sub } = res.locals.auth as { sub: string };
    const partner = await PartnerModel.findOne({ userId: sub }).select("kyc").lean();
    const kyc = partner?.kyc;
    sendSuccess(res, {
      status: String(kyc?.status ?? "not_started"),
      rejectionReason: kyc?.rejectionReason ?? null,
      submittedAt: kyc?.submittedAt ?? null,
      reviewedAt: kyc?.reviewedAt ?? null,
      documents: await Promise.all(
        (kyc?.documents ?? []).map(async (d) => ({
          id: String(d._id),
          type: d.type,
          label: d.label ?? d.type,
          mimeType: d.mimeType ?? null,
          status: d.status ?? "pending",
          reviewNote: d.reviewNote ?? null,
          uploadedAt: d.uploadedAt ?? null,
          // false = old record whose file was never saved on this server; the app asks the partner to upload it again.
          fileAvailable: (await kycDocumentExists(d.storageKey)) || /^https?:\/\//i.test(d.url ?? ""),
        })),
      ),
    });
  }),
);

// POST /api/v1/partner/documents  { type: "id_proof" | "address_proof", file: "data:<mime>;base64,..." }
// Lets a partner add a missing ID or address proof. Same checks as signup (PDF/JPG/PNG, max 5MB, real file bytes).
// The new file is saved as "pending" for the verification team.
const UPLOADABLE = { id_proof: "ID proof", address_proof: "Address proof" } as const;

partnerDocumentsRoutes.post(
  "/",
  ...base,
  asyncHandler(async (req, res) => {
    const { sub } = res.locals.auth as { sub: string };
    const { type, file } = (req.body ?? {}) as { type?: string; file?: string };
    if (type !== "id_proof" && type !== "address_proof") {
      res.status(400).json({ success: false, message: "Choose ID proof or address proof.", code: "VALIDATION_ERROR" });
      return;
    }
    if (typeof file !== "string" || !file) {
      res.status(400).json({ success: false, message: "Attach a PDF, JPG or PNG file.", code: "VALIDATION_ERROR" });
      return;
    }
    const label = UPLOADABLE[type];
    const stored = await saveKycDocument(file, label); // throws 400 INVALID_KYC_DOCUMENT on a bad file

    const partner = await PartnerModel.findOne({ userId: sub });
    if (!partner) {
      res.status(404).json({ success: false, message: "Partner profile not found", code: "NOT_FOUND" });
      return;
    }
    const kyc = partner.kyc;
    if (!kyc) {
      res.status(404).json({ success: false, message: "Partner profile not found", code: "NOT_FOUND" });
      return;
    }
    // One current document per type: replace an old one of the same type (for example a rejected file).
    const kept = kyc.documents.filter((d) => d.type !== type);
    kyc.documents.splice(0, kyc.documents.length, ...kept);
    kyc.documents.push({
      type,
      label,
      storageKey: stored.storageKey,
      mimeType: stored.mimeType,
      status: "pending",
      uploadedAt: new Date(),
    } as never);
    // New file means the team has to look again, unless the account is already in a review state.
    if (["not_started", "not_submitted", "rejected"].includes(String(kyc.status))) {
      kyc.status = "submitted";
      kyc.submittedAt = new Date();
      kyc.rejectionReason = undefined;
    }
    await partner.save();
    sendSuccess(res, { uploaded: true, type });
  }),
);

// GET /api/v1/partner/documents/:docId/file  -> streams the file (own documents only)
partnerDocumentsRoutes.get(
  "/:docId/file",
  ...base,
  asyncHandler(async (req, res) => {
    const { sub } = res.locals.auth as { sub: string };
    const partner = await PartnerModel.findOne({ userId: sub }).select("kyc.documents").lean();
    const doc = partner?.kyc?.documents?.find((d) => String(d._id) === req.params.docId);
    if (!doc) {
      res.status(404).json({ success: false, message: "Document not found", code: "NOT_FOUND" });
      return;
    }
    if (!doc.storageKey) {
      // Older records only have an external link; open that instead of failing.
      if (doc.url && /^https?:\/\//i.test(doc.url)) {
        // Fetch it on the server and pass it on. A redirect would make the browser call another site
        // directly, which CORS blocks (the app shows "Network error").
        const remote = await fetchLegacyUrl(doc.url);
        if (remote) {
          res.setHeader("Content-Type", doc.mimeType ?? remote.contentType);
          res.setHeader("Content-Disposition", "inline");
          res.setHeader("Cache-Control", "private, no-store");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.send(remote.buffer);
          return;
        }
      }
      res.status(404).json({ success: false, message: "This document has no stored file. Please upload it again.", code: "NOT_FOUND" });
      return;
    }
    const buffer = await readKycDocument(doc.storageKey);
    res.setHeader("Content-Type", doc.mimeType ?? "application/octet-stream");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(buffer);
  }),
);

export default partnerDocumentsRoutes;