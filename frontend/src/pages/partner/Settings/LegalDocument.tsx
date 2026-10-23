import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';
import type { LegalDocumentContent } from '@/content/terms';
import { PRIVACY_POLICY_PATH, TERMS_PATH } from './paths';
import './settings.css';

const TOKENS = /(support@homecarex\.com|privacy@homecarex\.com|\+91\s*93902\s*12572|\/contact|Privacy Policy|Terms and Conditions|Terms & Conditions|Help Center)/gi;

/** Emails, the phone number and mentions of the other policy become links that stay inside the partner area. */
function linkify(text: string): ReactNode[] {
  return text.split(TOKENS).map((part, i) => {
    const lower = part.toLowerCase();
    if (lower === 'support@homecarex.com' || lower === 'privacy@homecarex.com')
      return (
        <a key={i} href={`mailto:${part}`} className="ps-doc-link">
          {part}
        </a>
      );
    if (lower.replace(/\s+/g, '') === '+919390212572')
      return (
        <a key={i} href="tel:+919390212572" className="ps-doc-link">
          {part}
        </a>
      );
    if (lower === '/contact' || lower === 'help center')
      return (
        <Link key={i} to="/partner/help" className="ps-doc-link">
          {part}
        </Link>
      );
    if (lower === 'privacy policy')
      return (
        <Link key={i} to={PRIVACY_POLICY_PATH} className="ps-doc-link">
          {part}
        </Link>
      );
    if (lower === 'terms and conditions' || lower === 'terms & conditions')
      return (
        <Link key={i} to={TERMS_PATH} className="ps-doc-link">
          {part}
        </Link>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Paragraph({ text }: { text: string }) {
  const bullet = /^[\u2022-]\s+/.test(text);
  const body = bullet ? text.replace(/^[\u2022-]\s+/, '') : text;
  const m = body.match(/^((?:[A-Z0-9][\w\s&/()'"-]{1,55})):\s+([\s\S]*)$/);
  const content = m ? (
    <>
      <strong>{m[1]}:</strong> {linkify(m[2])}
    </>
  ) : (
    linkify(body)
  );
  return <p className={bullet ? 'ps-doc-bullet' : 'ps-doc-p'}>{content}</p>;
}

/** Reading view for Terms / Privacy inside the partner area. Same text as the public pages. */
export default function LegalDocument({ doc, other }: { doc: LegalDocumentContent; other: { label: string; to: string } }) {
  return (
    <div className="ps-root">
      <article className="ps-doc">
        <header>
          <p className="ps-doc-desc">{doc.description}</p>
          <p className="ps-muted">
            Last updated: <strong>{doc.lastUpdated}</strong>
          </p>
          {doc.pendingApprovalNotice ? (
            <p className="ps-doc-note" role="note">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{doc.pendingApprovalNotice}</span>
            </p>
          ) : null}
        </header>

        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className="ps-doc-section" aria-labelledby={`ps-h-${section.id}`}>
            <h2 id={`ps-h-${section.id}`}>{section.title}</h2>
            {section.content.map((p, i) => (
              <Paragraph key={i} text={p} />
            ))}
          </section>
        ))}

        <Link to={other.to} className="ps-row ps-link ps-doc-next">
          <span className="ps-row-text">
            <span className="ps-muted">Also read</span>
            <span className="ps-row-label">{other.label}</span>
          </span>
          <ChevronRight size={18} className="ps-chevron" aria-hidden="true" />
        </Link>
      </article>
    </div>
  );
}