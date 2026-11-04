import http, { type ApiResponse } from "@/lib/http";

export type DocStatus = "pending" | "verified" | "rejected";
export type KycState = "not_started" | "submitted" | "in_review" | "approved" | "rejected" | "suspended";

export interface PartnerDoc {
  id: string;
  type: string;
  label: string;
  mimeType: string | null;
  status: DocStatus;
  reviewNote: string | null;
  uploadedAt: string | null;
}

export interface PartnerDocuments {
  status: KycState;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  documents: PartnerDoc[];
}

export async function getMyDocuments(): Promise<PartnerDocuments> {
  const { data } = await http.get<ApiResponse<PartnerDocuments>>("/partner/documents");
  return data.data;
}

/** Fetches the file with the auth token and returns a temporary object URL (revoke it when done). */
export async function fetchDocumentBlobUrl(docId: string): Promise<string> {
  const res = await http.get<Blob>(`/partner/documents/${docId}/file`, { responseType: "blob" });
  return URL.createObjectURL(res.data);
}

export type UploadableType = "id_proof" | "address_proof";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });

/** Adds a missing ID proof or address proof. Same limits as signup: PDF, JPG or PNG, up to 5 MB. */
export async function uploadMyDocument(type: UploadableType, file: File): Promise<void> {
  await http.post("/partner/documents", { type, file: await toDataUrl(file) });
}