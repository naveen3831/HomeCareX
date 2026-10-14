import { Fragment, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ChevronDown, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import type { LegalDocumentContent } from "@/content/terms";
import { customerPath } from "@/routes/customerPath";
import { FOCUS_RING } from "@/components/customer/focusRing";

const LINK = clsx("font-semibold text-brand underline underline-offset-2 hover:brightness-90 rounded", FOCUS_RING);
const TOKENS = /(support@homecarex\.com|privacy@homecarex\.com|\+91\s*93902\s*12572|\/contact|Privacy Policy|Terms and Conditions|Terms & Conditions|Help Center)/gi;

/** Turns emails, the phone number and mentions of the other policy into links that stay inside the customer dashboard. */
function linkify(text: string): ReactNode[] {
  return text.split(TOKENS).map((part, i) => {
    const lower = part.toLowerCase();
    if (lower === "support@homecarex.com" || lower === "privacy@homecarex.com") return <a key={i} href={`mailto:${part}`} className={LINK}>{part}</a>;
    if (lower.replace(/\s+/g, "") === "+919390212572") return <a key={i} href="tel:+919390212572" className={LINK}>{part}</a>;
    if (lower === "/contact" || lower === "help center") return <Link key={i} to={customerPath("/support")} className={LINK}>{part}</Link>;
    if (lower === "privacy policy") return <Link key={i} to={customerPath("/profile/privacy")} className={LINK}>{part}</Link>;
    if (lower === "terms and conditions" || lower === "terms & conditions") return <Link key={i} to={customerPath("/profile/terms")} className={LINK}>{part}</Link>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Paragraph({ text }: { text: string }) {
  const bullet = /^[•\-]\s+/.test(text);
  const body = bullet ? text.replace(/^[•\-]\s+/, "") : text;
  const m = body.match(/^((?:[A-Z0-9][\w\s&/()'"-]{1,55})):\s+([\s\S]*)$/);
  const content = m ? (
    <>
      <strong className="font-semibold text-ink">{m[1]}:</strong> {linkify(m[2])}
    </>
  ) : (
    linkify(body)
  );
  if (bullet)
    return (
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
        <p className="text-[15px] leading-relaxed text-muted">{content}</p>
      </div>
    );
  return <p className="text-[15px] leading-relaxed text-muted">{content}</p>;
}

interface Props {
  doc: LegalDocumentContent;
  /** The other document, offered at the bottom ("Also read…"). */
  other: { label: string; to: string; icon: LucideIcon };
}

/**
 * Customer-dashboard reading view for a legal document (Terms / Privacy). Same content as the public pages,
 * styled like the rest of the dashboard: a summary card, then collapsible numbered sections (first one open).
 */
export default function LegalDocumentView({ doc, other }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => (doc.sections[0] ? { [doc.sections[0].id]: true } : {}));
  const allOpen = doc.sections.length > 0 && doc.sections.every((s) => open[s.id]);
  const toggleAll = () => setOpen(Object.fromEntries(doc.sections.map((s) => [s.id, !allOpen])));
  const OtherIcon = other.icon;

  return (
    <div className="space-y-5">
      <section>
        <p className="text-sm leading-relaxed text-ink">{doc.description}</p>
        <p className="mt-2 text-xs font-semibold text-muted">
          Last updated: <span className="text-ink">{doc.lastUpdated}</span>
        </p>
        {doc.pendingApprovalNotice && (
          <div role="note" className="mt-3 flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span className="font-semibold">{doc.pendingApprovalNotice}</span>
          </div>
        )}
      </section>

      {doc.sections.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-line p-6 text-center text-sm text-muted">This document is being updated. Please check back shortly.</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{doc.sections.length} sections</h2>
            <button type="button" onClick={toggleAll} className={clsx("rounded-full px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft", FOCUS_RING)}>
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          </div>

          <ul className="divide-y divide-line/70 border-y border-line/70">
            {doc.sections.map((section, idx) => {
              const isOpen = Boolean(open[section.id]);
              return (
                <li key={section.id} id={section.id} className="scroll-mt-20">
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`panel-${section.id}`}
                      onClick={() => setOpen((o) => ({ ...o, [section.id]: !o[section.id] }))}
                      className={clsx("flex min-h-[60px] w-full items-center gap-3.5 py-3 text-left", FOCUS_RING)}
                    >
                      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft text-xs font-bold text-brand">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink">{section.title.replace(/^\d+\.\s*/, "")}</span>
                      <ChevronDown aria-hidden="true" className={clsx("h-4 w-4 shrink-0 text-muted/70 transition-transform duration-200", isOpen && "rotate-180")} />
                    </button>
                  </h3>
                  {isOpen && (
                    <div id={`panel-${section.id}`} className="space-y-3 pb-5">
                      {section.content.map((p, i) => (
                        <Paragraph key={i} text={p} />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Link
        to={other.to}
        className={clsx("group flex items-center gap-3.5 py-2", FOCUS_RING)}
      >
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
          <OtherIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted">Also read</span>
          <span className="block text-[15px] font-semibold text-ink">{other.label}</span>
        </span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 text-muted/70 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

