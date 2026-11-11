import { Link } from "react-router-dom";
import { Banknote, ChevronRight, FileText, Mail, MapPin, Phone, Wrench, type LucideIcon } from "lucide-react";
import type { PartnerJoinDetails } from "@/services/partnerApi";
import type { PartnerDocuments } from "@/pages/partner/Documents/documents.api";

interface Item { icon: LucideIcon; label: string; value: string }

function Line({ icon: Icon, label, value }: Item) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
        <Icon size={16} className="text-[#4338ca]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-slate-500">{label}</span>
        <span className="block break-words text-sm font-medium text-slate-900">{value}</span>
      </span>
    </li>
  );
}

function docSummary(docs?: PartnerDocuments): { text: string; tone: string } {
  if (!docs) return { text: "Tap to open", tone: "text-slate-500" };
  const n = docs.documents.length;
  if (n === 0) return { text: "Not uploaded yet", tone: "text-amber-700" };
  const pending = docs.documents.some((d) => d.status === "pending");
  const rejected = docs.documents.some((d) => d.status === "rejected");
  const count = `${n} ${n === 1 ? "document" : "documents"}`;
  if (rejected) return { text: `${count} · needs attention`, tone: "text-red-700" };
  if (pending) return { text: `${count} · under review`, tone: "text-amber-700" };
  return { text: `${count} · verified`, tone: "text-emerald-700" };
}

interface Props {
  details?: PartnerJoinDetails;
  docs?: PartnerDocuments;
  loading: boolean;
  /** Fallbacks while the server copy loads. */
  phone?: string;
  email?: string;
}

/** About-you card. Only fields that have a value are listed, so nothing shows as an empty row. */
export default function JoinDetailsCard({ details, docs, loading, phone, email }: Props) {
  if (loading && !details && !docs) {
    return <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-busy="true" />;
  }
  const j = details?.joined;
  const a = j?.address;
  const address = [a?.line1, a?.city, a?.state, a?.pincode].filter(Boolean).join(", ");
  const bank = j?.bank;
  const payout = bank
    ? [bank.accountHolder, bank.upiId, bank.accountLast4 ? `Account ending ${bank.accountLast4}` : ""].filter(Boolean).join(" · ")
    : "";
  const mobile = details?.phone || phone;
  const mail = details?.email || email;

  const items: Item[] = [
    mobile ? { icon: Phone, label: "Mobile", value: `+91 ${mobile.replace(/\D/g, "").slice(-10)}` } : null,
    mail ? { icon: Mail, label: "Email", value: mail } : null,
    address ? { icon: MapPin, label: "Address", value: address } : null,
    j?.categories?.length
      ? { icon: Wrench, label: "Services", value: [...j.categories, ...(j.skills ?? [])].join(", ") }
      : j?.skills?.length
        ? { icon: Wrench, label: "Skills", value: j.skills.join(", ") }
        : null,
    payout ? { icon: Banknote, label: "Payout", value: payout } : null,
  ].filter((x): x is Item => x !== null);

  const doc = docSummary(docs);

  return (
    <section aria-label="About you" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm sm:px-5">
      <ul className="divide-y divide-slate-100">
        {items.map((it) => <Line key={it.label} {...it} />)}
        <li>
          <Link to="/partner/profile/documents" className="flex items-center gap-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
              <FileText size={16} className="text-[#4338ca]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-900">ID and address proof</span>
              <span className={`block text-xs font-medium ${doc.tone}`}>{doc.text}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden />
          </Link>
        </li>
      </ul>
    </section>
  );
}
