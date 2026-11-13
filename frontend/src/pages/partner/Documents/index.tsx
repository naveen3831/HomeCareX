import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, FileText, Home, CreditCard, RefreshCw, ShieldCheck, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import DocumentViewer from "@/components/DocumentViewer";
import {
  ACCEPTED_TYPES,
  MAX_UPLOAD_BYTES,
  fetchDocumentBlob,
  getMyDocuments,
  uploadMyDocument,
  type DocStatus,
  type PartnerDoc,
  type PartnerDocuments,
  type UploadableType,
} from "./documents.api";
import "./Documents.css";

const STATUS_TEXT: Record<DocStatus, string> = { pending: "Under review", verified: "Verified", rejected: "Rejected" };

const BANNER: Record<string, { title: string; text: string; tone: "ok" | "wait" | "bad" }> = {
  approved: { title: "Documents verified", text: "Your documents were approved by our team.", tone: "ok" },
  rejected: { title: "Verification needs attention", text: "One or more documents were not accepted.", tone: "bad" },
  suspended: { title: "Account on hold", text: "Please contact support for help.", tone: "bad" },
  submitted: { title: "Under review", text: "We received your documents. We'll email you once they are verified.", tone: "wait" },
  in_review: { title: "Under review", text: "Our team is checking your documents.", tone: "wait" },
  not_started: { title: "No documents yet", text: "Documents you upload when joining will appear here.", tone: "wait" },
};

const MISSING_BANNER = { title: "No documents on file", text: "Upload your ID proof and address proof below so our team can verify you.", tone: "wait" as const };

const UPLOAD_SLOTS: { type: UploadableType; label: string }[] = [
  { type: "id_proof", label: "ID proof" },
  { type: "address_proof", label: "Address proof" },
];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

const iconFor = (type: string) => (type === "address_proof" ? Home : type === "id_proof" ? CreditCard : FileText);

export default function PartnerDocumentsPage() {
  const queryClient = useQueryClient();
  const [data, setData] = useState<PartnerDocuments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ doc: PartnerDoc; url: string; mimeType: string } | null>(null);
  const [uploading, setUploading] = useState<UploadableType | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedNote, setUploadedNote] = useState<string | null>(null);
  const pickType = useRef<UploadableType>("id_proof");
  const fileInput = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getMyDocuments());
    } catch {
      setError("Could not load your documents. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Release the temporary file URL when the viewer closes.
  useEffect(() => {
    if (!viewer) return;
    return () => URL.revokeObjectURL(viewer.url);
  }, [viewer]);

  // Show errors where the person is looking, not only at the top of a page they may have scrolled past.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const open = async (doc: PartnerDoc) => {
    setOpening(doc.id);
    setError(null);
    try {
      const file = await fetchDocumentBlob(doc.id);
      setViewer({ doc, url: file.url, mimeType: doc.mimeType || file.mimeType });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      setError(reason ? `Could not open this document: ${reason}` : "Could not open this document. Please try again.");
    } finally {
      setOpening(null);
    }
  };

  const chooseFile = (type: UploadableType) => {
    pickType.current = type;
    setUploadError(null);
    setUploadedNote(null);
    fileInput.current?.click();
  };

  const onFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again after an error
    if (!file) return;
    const type = pickType.current;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Only PDF, JPG and PNG files are accepted.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("File must be under 5 MB.");
      return;
    }
    setUploading(type);
    setUploadError(null);
    try {
      await uploadMyDocument(type, file);
      setUploadedNote("Uploaded. Our team will review it soon.");
      await load();
      // The Profile page shows the same documents: make it fetch the new list.
      void queryClient.invalidateQueries({ queryKey: ["partner", "documents"] });
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUploadError(msg ?? "Could not upload the file. Please try again.");
    } finally {
      setUploading(null);
    }
  };

  const hasDocs = (data?.documents.length ?? 0) > 0;
  // "Verified" only makes sense when there is something on file to verify.
  const banner = data && !hasDocs
    ? MISSING_BANNER
    : (BANNER[data?.status ?? "not_started"] ?? BANNER.not_started);
  const missing = UPLOAD_SLOTS.filter((s) => !data?.documents.some((d) => d.type === s.type));
  const BannerIcon = banner.tone === "ok" ? ShieldCheck : banner.tone === "bad" ? AlertTriangle : Clock;

  return (
    <div className="pdoc">
      {data && (
        <div className={`pdoc-banner pdoc-banner--${banner.tone}`}>
          <span className="pdoc-banner__icon" aria-hidden="true"><BannerIcon size={20} /></span>
          <div className="pdoc-banner__body">
            <h2>{banner.title}</h2>
            <p>{data.status === "rejected" && data.rejectionReason ? data.rejectionReason : banner.text}</p>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="pdoc-error" ref={errorRef}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>Retry</button>
        </div>
      )}

      {loading && !data ? (
        <div className="pdoc-loading" aria-busy="true">
          <RefreshCw size={22} className="pdoc-spin" aria-hidden="true" />
          <p>Loading your documents…</p>
        </div>
      ) : (
        data && (
          <>
            <h3 className="pdoc-heading">{hasDocs ? "Your documents" : "Documents"}</h3>
            {data.documents.length === 0 ? (
              <div className="pdoc-empty">
                <FileText size={28} aria-hidden="true" />
                <p>No documents found</p>
              </div>
            ) : (
              <ul className="pdoc-list">
                {data.documents.map((d) => {
                  const Icon = iconFor(d.type);
                  // The record exists but its file was never saved on the server: viewing is impossible, so offer a re-upload.
                  const fileMissing = d.fileAvailable === false;
                  const canReupload = fileMissing && (d.type === "id_proof" || d.type === "address_proof");
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        className="pdoc-row"
                        onClick={() => (canReupload ? chooseFile(d.type as UploadableType) : void open(d))}
                        disabled={opening === d.id || uploading !== null}
                        aria-label={canReupload ? `Upload ${d.label} again` : `View ${d.label}`}
                      >
                        <span className="pdoc-row__icon" aria-hidden="true"><Icon size={20} /></span>
                        <span className="pdoc-row__main">
                          <span className="pdoc-row__title">{d.label}</span>
                          <span className="pdoc-row__meta">
                            {d.uploadedAt ? `Uploaded ${fmtDate(d.uploadedAt)}` : "Uploaded"}
                          </span>
                          {d.status === "rejected" && d.reviewNote && <span className="pdoc-row__note">{d.reviewNote}</span>}
                          {fileMissing && <span className="pdoc-row__note">The file could not be found. Tap to upload it again.</span>}
                        </span>
                        <span className={`pdoc-chip pdoc-chip--${d.status}`}>
                          {d.status === "verified" && <CheckCircle2 size={12} aria-hidden="true" />}
                          {STATUS_TEXT[d.status]}
                        </span>
                        {opening === d.id || (canReupload && uploading === d.type) ? (
                          <RefreshCw size={16} className="pdoc-spin" aria-hidden="true" />
                        ) : canReupload ? (
                          <Upload size={16} className="pdoc-row__go" aria-hidden="true" />
                        ) : (
                          <ChevronRight size={18} className="pdoc-row__go" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {missing.length > 0 && (
              <div className="pdoc-upload">
                <h3 className="pdoc-heading">Add missing documents</h3>
                <div className="pdoc-upload__row">
                  {missing.map((m) => (
                    <button
                      key={m.type}
                      type="button"
                      className="pdoc-upload__btn"
                      onClick={() => chooseFile(m.type)}
                      disabled={uploading !== null}
                    >
                      {uploading === m.type ? <RefreshCw size={16} className="pdoc-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
                      {uploading === m.type ? "Uploading…" : `Upload ${m.label}`}
                    </button>
                  ))}
                </div>
                <p className="pdoc-upload__hint">PDF, JPG or PNG, up to 5 MB.</p>
              </div>
            )}
            {uploadError && (
              <div role="alert" className="pdoc-error">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{uploadError}</span>
              </div>
            )}
            {uploadedNote && <p role="status" className="pdoc-upload__ok">{uploadedNote}</p>}
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="pdoc-upload__input"
              onChange={(e) => void onFilePicked(e)}
              aria-hidden="true"
              tabIndex={-1}
            />
            <p className="pdoc-foot">Your documents are private and only visible to you and our verification team.</p>
          </>
        )
      )}

      {viewer && (
        <div className="pdoc-modal" role="dialog" aria-modal="true" aria-label={viewer.doc.label}>
          <header className="pdoc-modal__bar">
            <strong>{viewer.doc.label}</strong>
            <button type="button" onClick={() => setViewer(null)} aria-label="Close"><X size={20} /></button>
          </header>
          <div className="pdoc-modal__body">
            <DocumentViewer url={viewer.url} name={viewer.doc.label} mimeType={viewer.mimeType || undefined} height={Math.max(300, Math.round(window.innerHeight - 190))} />
          </div>
        </div>
      )}
    </div>
  );
}