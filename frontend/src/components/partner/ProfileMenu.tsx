import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Briefcase,
  ChevronRight,
  FileText,
  HelpCircle,
  LifeBuoy,
  LogOut,
  MapPin,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { partnerApi, type PartnerProfileInput } from "@/services/partnerApi";
import { getMyDocuments, type PartnerDocuments } from "@/pages/partner/Documents/documents.api";
import EditProfileSheet from "./EditProfileSheet";

interface MenuItem { key: string; label: string; to: string; description: string; icon: LucideIcon }

/** Short badge shown under the name: where the partner stands with verification. */
function verification(docs: PartnerDocuments | undefined): { label: string; tone: string } | null {
  if (!docs) return null;
  const none = docs.documents.length === 0;
  switch (docs.status) {
    case "approved":
      return none
        ? { label: "Documents missing", tone: "bg-amber-50 text-amber-700" }
        : { label: "Verified", tone: "bg-emerald-50 text-emerald-700" };
    case "submitted":
    case "in_review":
      return { label: "Under review", tone: "bg-amber-50 text-amber-700" };
    case "rejected":
      return { label: "Action needed", tone: "bg-red-50 text-red-700" };
    case "suspended":
      return { label: "Suspended", tone: "bg-red-50 text-red-700" };
    default:
      return { label: "Not verified", tone: "bg-slate-100 text-slate-600" };
  }
}

function documentsHint(docs: PartnerDocuments | undefined): string {
  if (!docs) return "ID proof, address proof and approval status";
  if (docs.documents.length === 0) return "Upload your ID and address proof";
  switch (docs.status) {
    case "approved": return "Approved. View your documents";
    case "submitted":
    case "in_review": return "Our team is checking your documents";
    case "rejected": return "Something needs fixing. Tap to see why";
    default: return "ID proof, address proof and approval status";
  }
}

function MenuGroup({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.map(({ key, label, to, description, icon: Icon }) => (
          <li key={key}>
            <Link
              to={to}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#4338ca] sm:px-4 sm:py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                <Icon size={18} className="text-[#4338ca]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{label}</span>
                <span className="block truncate text-xs text-slate-500">{description}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2.5 text-center">
      <p className="text-base font-extrabold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

/**
 * Profile page: who the partner is (name, contact, verification, rating, jobs done) and the pages that belong to
 * their profile. App settings, help and log out sit in their own groups at the bottom, so nothing is listed twice.
 */
export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PartnerProfileInput>({
    name: user?.name ?? "Partner",
    phone: (user?.phone ?? "").replace(/\D/g, "").slice(-10),
  });
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  const dashboard = useQuery({ queryKey: ["partner", "dashboard"], queryFn: () => partnerApi.getDashboard(), retry: 1 });
  const docs = useQuery({ queryKey: ["partner", "documents"], queryFn: getMyDocuments, retry: 1 });

  const d = dashboard.data;
  const rating = d?.performance ? d.performance.rating : d && d.rating > 0 ? d.rating : null;
  const reviews = d?.performance?.ratingCount ?? 0;
  const jobsDone = d ? (d.completedTotal ?? d.completedJobs) : null;
  const badge = verification(docs.data);

  const mine: MenuItem[] = [
    { key: "services", label: "My services", to: "/partner/services", description: "What you offer and your training", icon: Wrench },
    { key: "area", label: "Service area", to: "/partner/service-area", description: "Cities and distance you cover", icon: MapPin },
    { key: "documents", label: "Documents and verification", to: "/partner/profile/documents", description: documentsHint(docs.data), icon: FileText },
    { key: "preferences", label: "Preferences", to: "/partner/profile/preferences", description: "Language and job preferences", icon: SlidersHorizontal },
  ];
  const work: MenuItem[] = [
    { key: "jobs", label: "My jobs", to: "/partner/jobs", description: "Requests, upcoming and past jobs", icon: Briefcase },
    { key: "performance", label: "Performance", to: "/partner/performance", description: "Ratings, reviews, improvement tips", icon: TrendingUp },
  ];
  const help: MenuItem[] = [
    { key: "support", label: "Support", to: "/partner/support", description: "Raise a ticket and track replies", icon: LifeBuoy },
    { key: "safety", label: "Safety and SOS", to: "/partner/safety", description: "Emergency help and safety tips", icon: Shield },
    { key: "help", label: "Help center", to: "/partner/help", description: "Answers to common questions", icon: HelpCircle },
  ];
  const account: MenuItem[] = [
    { key: "security", label: "Account security", to: "/partner/security", description: "Password, sessions and devices", icon: ShieldCheck },
    { key: "settings", label: "Settings", to: "/partner/settings", description: "Notifications and app settings", icon: Settings },
  ];

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Who you are */}
      <section aria-label="Your profile" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#4338ca] text-2xl font-semibold text-white sm:h-16 sm:w-16"
            aria-hidden
          >
            {profile.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{profile.name}</h2>
            <p className="text-xs text-slate-500 sm:text-sm">HomeCareX partner</p>
            {badge && (
              <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.tone}`}>
                <BadgeCheck size={12} aria-hidden /> {badge.label}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 self-start rounded-full border border-[#4338ca] px-4 py-1 text-sm font-semibold text-[#4338ca] hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca]"
          >
            Edit
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Your numbers">
          <Stat label={reviews > 0 ? `${reviews} ${reviews === 1 ? "review" : "reviews"}` : "Rating"} value={rating === null ? "New" : `${rating.toFixed(1)} ★`} />
          <Stat label="Jobs done" value={jobsDone === null ? "–" : String(jobsDone)} />
          <Stat label="Status" value={badge ? badge.label : "–"} />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Mobile</dt>
            <dd className="font-medium text-slate-900">{profile.phone ? `+91 ${profile.phone}` : "Not added"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="truncate font-medium text-slate-900">{user?.email ?? "Not added"}</dd>
          </div>
        </dl>
      </section>

      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {notice}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <MenuGroup title="My profile" items={mine} />
          <MenuGroup title="My work" items={work} />
        </div>
        <div className="space-y-4">
          <MenuGroup title="Help and safety" items={help} />
          <MenuGroup title="Account" items={account} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        disabled={signingOut}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60"
      >
        <LogOut size={18} aria-hidden />
        {signingOut ? "Signing out..." : "Log out"}
      </button>

      {editing && (
        <EditProfileSheet
          initial={profile}
          email={user?.email}
          onClose={() => setEditing(false)}
          onSaved={(value) => {
            setProfile(value);
            setEditing(false);
            setNotice("Profile updated.");
          }}
        />
      )}
    </div>
  );
}