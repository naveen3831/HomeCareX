import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  Plus,
  Share2,
  ShieldCheck,
  Star,
  Wallet,
  X,
  ZoomIn,
} from "lucide-react";
import GallerySkeleton from "../../../components/public/skeletons/GallerySkeleton";
import ServiceInfoSkeleton from "../../../components/public/skeletons/ServiceInfoSkeleton";
import ReviewSkeleton from "../../../components/public/skeletons/ReviewSkeleton";
import StickyBookNow from "../../../components/public/StickyBookNow";
import NotFound from "../NotFound";
import { useAuth } from "../../../hooks/useAuth"; // adjust to your real path
import {
  useRelatedServices,
  useService,
  useServiceReviews,
} from "@/hooks/useService";
import Seo from "../../../components/common/Seo";
import { breadcrumbLd, faqLd, serviceLd } from "../../../lib/jsonld";
import { safeAlt, sanitizePathSegment } from "@/lib/querySanitize";
import type { SlotAvailability } from "@/types/catalog";

type TabId = "overview" | "included" | "faqs" | "reviews";

interface Faq {
  id: string;
  question: string;
  answer: string;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "included", label: "Included & add-ons" },
  { id: "faqs", label: "FAQs" },
  { id: "reviews", label: "Reviews" },
];

/* General questions shown for every service, after the service's own FAQs. */
const commonFaqs: Faq[] = [
  { id: "common-1", question: "How do I book this service?", answer: "Tap Book now, pick your date and time, add any extras, and confirm. You will get a confirmation straight away." },
  { id: "common-2", question: "How do I know the professional is verified?", answer: "Every professional is background-checked and trained before joining. You can see their details before they arrive." },
  { id: "common-3", question: "What payment methods are accepted?", answer: "You pay after the service is completed. Cash and common digital payment options are accepted." },
  { id: "common-4", question: "What if I am not happy with the work?", answer: "Contact our support team within 24 hours of the service and we will arrange a fix or look into the issue." },
  { id: "common-5", question: "Can I change the time or address after booking?", answer: "Yes. You can change the slot or address before the professional is on the way, at no extra charge." },
  { id: "common-6", question: "Will the professional arrive on time?", answer: "Yes. You will get updates when the professional is on the way. If there is a delay, we will let you know." },
];

const trustPoints = [
  { icon: BadgeCheck, title: "Verified professionals", text: "Background-checked and trained experts." },
  { icon: ShieldCheck, title: "Safe and reliable", text: "Quality work you can count on." },
  { icon: CalendarCheck, title: "Flexible scheduling", text: "Pick a time that suits you." },
  { icon: Headphones, title: "Customer support", text: "We're here whenever you need help." },
];

/* ======================================================================
   IMAGE RULES: which pictures belong to which service.
   Matching is done on words in the service name (lower case).
   ORDER MATTERS: the first rule that matches wins, so specific rules
   (e.g. "kitchen deep cleaning") must stay above general ones ("clean").
   All files live in frontend/public/images.
   ====================================================================== */

const FALLBACK_IMAGE = "/images/background-800.webp";

/** "home-cleaning" -> home-cleaning, home-cleaning-2, -3, -4 (.webp) */
const withVariants = (base: string): string[] => [
  `/images/${base}.webp`,
  `/images/${base}-2.webp`,
  `/images/${base}-3.webp`,
  `/images/${base}-4.webp`,
];

/** Services that have only one image (or a custom list of files). */
const only = (...files: string[]): string[] =>
  files.map((file) => `/images/${file}.webp`);

const has = (name: string, ...words: string[]) =>
  words.some((word) => name.includes(word));

const imageRules: { match: (name: string) => boolean; images: string[] }[] = [
  // Pest control
  { match: (n) => has(n, "bed bug"), images: only("bed-bug-treatment") },
  {
    match: (n) => has(n, "termite"),
    images: only("termite-treatment-clean", "TermiteTreatment"),
  },
  { match: (n) => has(n, "mosquito"), images: only("mosquito-fogging") },
  {
    match: (n) => has(n, "pest"),
    images: only("pest-control-clean", "pestControl"),
  },

  // Special cleaning
  {
    match: (n) => has(n, "sanitization", "sanitisation", "sanitize"),
    images: only("full-home-sanitization"),
  },
  { match: (n) => has(n, "water tank"), images: only("water-tank-cleaning") },
  {
    match: (n) => has(n, "terrace", "waterproof"),
    images: only("terrace-waterproofing"),
  },
  {
    match: (n) => has(n, "kitchen") && has(n, "deep"),
    images: [
      "/images/kitchen-deep-cleaning.webp",
      ...withVariants("kitchen-cleaning").slice(1),
    ],
  },
  { match: (n) => has(n, "kitchen"), images: withVariants("kitchen-cleaning") },
  {
    match: (n) => has(n, "bathroom") && has(n, "deep"),
    images: [
      "/images/bathroom-deep-cleaning.webp",
      ...withVariants("bathroom-cleaning").slice(1),
    ],
  },
  { match: (n) => has(n, "bathroom"), images: withVariants("bathroom-cleaning") },
  {
    match: (n) => has(n, "deep") && has(n, "clean"),
    images: withVariants("deep-cleaning"),
  },
  { match: (n) => has(n, "clean"), images: withVariants("home-cleaning") },

  // Appliances
  { match: (n) => has(n, "geyser"), images: only("geyser-installation-repair") },
  {
    match: (n) => has(n, "refrigerator", "fridge"),
    images: only("refrigerator-repair"),
  },
  {
    match: (n) => has(n, "washing machine"),
    images: only("washing-machine-repair"),
  },
  {
    match: (n) => has(n, "microwave", "oven"),
    images: only("microwave-oven-repair"),
  },
  {
    match: (n) => has(n, "ac service", "gas refill", "appliance"),
    images: withVariants("appliance-repair"),
  },

  // Electrical and plumbing
  { match: (n) => has(n, "electric"), images: withVariants("electrical") },
  {
    match: (n) => has(n, "plumb"),
    images: [
      "/images/plumbing-1200.webp", // much lighter than plumbing.webp
      ...withVariants("plumbing").slice(1),
    ],
  },

  // Painting
  {
    match: (n) => has(n, "texture", "accent wall"),
    images: only("texture-accent-wall"),
  },
  {
    match: (n) => has(n, "room") && has(n, "paint"),
    images: only("room-painting-per-room", "painting-category"),
  },
  { match: (n) => has(n, "paint"), images: withVariants("painting") },

  // Beauty and wellness
  { match: (n) => has(n, "massage"), images: only("full-body-massage") },
  {
    match: (n) => has(n, "spa"),
    images: only("Home-spa-women", "Home-spa-women-banner"),
  },
  { match: (n) => has(n, "makeup", "bridal"), images: only("bridal-makeup") },
  {
    match: (n) => has(n, "haircut", "grooming"),
    images: only("mens-haircut-grooming"),
  },

  // Maintenance
  {
    match: (n) => has(n, "maintenance"),
    images: withVariants("home-maintenance"),
  },
];

/** All images for a service. The first one is the cover image. */
function getServiceImages(serviceName: string): string[] {
  const name = serviceName.toLowerCase();
  const rule = imageRules.find((r) => r.match(name));
  return rule ? rule.images : [FALLBACK_IMAGE];
}

/* ---------- Formatting helpers ---------- */

const formatPrice = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** 45 -> "45 min", 150 -> "2 hr 30 min", 180 -> "3 hrs", 2880 -> "2 days" */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} hr ${m} min` : `${h} hr${h > 1 ? "s" : ""}`;
  }
  const days = Math.round(minutes / 1440);
  return `${days} day${days > 1 ? "s" : ""}`;
}

const kolkataDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d); // YYYY-MM-DD

/** "2026-10-17" -> "Today" / "Tomorrow" / "18 Oct" (Asia/Kolkata) */
function formatNextSlot(date: string): string {
  if (date === kolkataDate(new Date())) return "Today";
  if (date === kolkataDate(new Date(Date.now() + 24 * 60 * 60 * 1000))) {
    return "Tomorrow";
  }
  return new Date(`${date}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

/** Short label for the quick-facts bar and the booking card. */
function earliestLabel(slot: SlotAvailability): string {
  if (slot.hasSlots === null) return "Shown at booking";
  if (!slot.hasSlots) return "No slots soon";
  return slot.nextAvailableDate
    ? formatNextSlot(slot.nextAvailableDate)
    : "This week";
}

const formatReviewDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

/* Small shared star row so the markup is not repeated everywhere */
const Stars: React.FC<{
  value: number;
  size?: number;
  label: string;
  emptyClass?: string;
}> = ({ value, size = 16, label, emptyClass = "text-[#d1d5db]" }) => (
  <span role="img" aria-label={label} className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={size}
        aria-hidden="true"
        fill={n <= Math.round(value) ? "#ff8a3d" : "none"}
        className={n <= Math.round(value) ? "text-[#ff8a3d]" : emptyClass}
      />
    ))}
  </span>
);

const focusRing =
  "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#6366f1]/30";

const pageWrap =
  "relative mx-auto max-w-7xl px-4 pb-32 pt-3 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16 lg:pt-10";

/* ======================================================================
   Route component: reads the slug and remounts the page when it changes,
   so gallery, tab and FAQ state always start fresh for a new service.

   The slug comes from the address bar, so it is checked first: a slug with
   spaces, "..", markup or 100+ characters can never match a service, so we
   show the not-found page without sending any request.
   ====================================================================== */
const ServiceDetails: React.FC = () => {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = sanitizePathSegment(rawSlug);
  if (!slug) return <NotFound />;
  return <ServiceDetailsPage key={slug} slug={slug} />;
};

const ServiceDetailsPage: React.FC<{ slug: string }> = ({ slug }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  /* ---------- API data ---------- */
  const serviceQuery = useService(slug);
  const service = serviceQuery.data;

  /* ---------- Tabs (kept in the URL: ?tab=faqs) ---------- */
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabId =
    tabs.find((t) => t.id === tabParam)?.id ?? "overview";

  const setActiveTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    setSearchParams(next, { replace: true });
  };

  /* Reviews are only requested once the Reviews tab is opened */
  const reviewsQuery = useServiceReviews(service?.id, activeTab === "reviews");
  const relatedQuery = useRelatedServices(service?.category.slug, service?.id);
  const related = relatedQuery.data ?? [];

  /* ---------- Photos ---------- */
  const [failed, setFailed] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);

  const faqBaseId = useId();
  const faqButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const lightboxCloseRef = useRef<HTMLButtonElement | null>(null);

  /* Images are picked from the service name (see IMAGE RULES above),
     so the details page shows pictures that match the service.
     Alt text is built from the service name, so it goes through safeAlt
     (no markup, no control characters, capped length). */
  const allImages = service ? getServiceImages(service.name) : [];

  const photos = allImages
    .map((url, index) => ({
      url,
      alt: service
        ? safeAlt(
            `${service.name} – photo ${index + 1}`,
            `Service photo ${index + 1}`,
          )
        : "",
    }))
    .filter((item) => !failed.includes(item.url));

  const markFailed = (url: string) =>
    setFailed((prev) => (prev.includes(url) ? prev : [...prev, url]));

  /* ---------- Pop-up viewer (lightbox) ---------- */
  const total = photos.length;
  const selectedIndex = Math.min(selected, Math.max(total - 1, 0));
  const lightboxIndex =
    lightbox !== null && total > 0 ? Math.min(lightbox, total - 1) : null;
  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;
  const isLightboxOpen = lightbox !== null;

  const showPrev = useCallback(
    () =>
      setLightbox((i) =>
        i === null || total === 0 ? i : (i - 1 + total) % total,
      ),
    [total],
  );

  const showNext = useCallback(
    () =>
      setLightbox((i) =>
        i === null || total === 0 ? i : (i + 1) % total,
      ),
    [total],
  );

  // Esc closes, arrows move. Page scroll is locked while open.
  // Focus moves into the viewer and goes back to where it was on close.
  useEffect(() => {
    if (!isLightboxOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    lightboxCloseRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isLightboxOpen, showPrev, showNext]);

  /* ======================= Page states ======================= */

  if (serviceQuery.isError) {
    if (serviceQuery.error.status === 404) return <NotFound />;

    return (
      <main className="min-h-screen bg-[#f6f7fd]">
        <div className={pageWrap}>
          <div
            role="alert"
            className="mx-auto mt-16 max-w-lg rounded-[2rem] border border-[#e9ebf7] bg-white p-8 text-center shadow-sm"
          >
            <h1 className="text-2xl font-extrabold text-[#11104f]">
              We couldn't load this service
            </h1>
            <p className="mt-2 text-sm text-[#6b6b8a]">
              Please check your connection and try again.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => serviceQuery.refetch()}
                className={`rounded-full bg-gradient-to-r from-[#4338ca] to-[#6d5dfc] px-6 py-3 text-sm font-extrabold text-white ${focusRing}`}
              >
                Try again
              </button>
              <Link
                to="/services"
                className={`rounded-full border border-[#e4e7f5] bg-white px-6 py-3 text-sm font-bold text-[#4338ca] ${focusRing}`}
              >
                All services
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!service) {
    return (
      <main
        aria-busy="true"
        className="relative min-h-screen overflow-x-clip bg-[#f6f7fd]"
      >
        <div className={pageWrap}>
          <nav aria-label="Breadcrumb" className="mb-4 sm:mb-6">
            <Link
              to="/services"
              className={`inline-flex items-center gap-1.5 rounded-full border border-white bg-white/70 px-4 py-2 text-sm font-bold text-[#4338ca] shadow-sm backdrop-blur ${focusRing}`}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Services
            </Link>
          </nav>
          <GallerySkeleton />
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
            <div className="lg:order-2 lg:sticky lg:top-6">
              <ServiceInfoSkeleton />
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ======================= Derived data ======================= */

  const duration = formatDuration(service.durationMinutes);
  const hasRatings = service.ratingCount > 0;
  const slot = service.slotAvailability;
  const earliest = earliestLabel(slot);
  const cover = allImages[0];
  const allFaqs: Faq[] = [
    ...service.faqs.map(({ id, question, answer }) => ({ id, question, answer })),
    ...commonFaqs,
  ];

  const goToSection = (tabId: TabId) => {
    setActiveTab(tabId);
    document
      .getElementById("service-tabs")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: service.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled or clipboard blocked */
    }
  };

  /* Book now: logged in -> booking page; logged out -> login, then back to booking */
  const handleBookNow = () => {
    const bookPath = `/customer/book/${encodeURIComponent(service.slug)}`;
    if (isAuthenticated) {
      navigate(bookPath);
      return;
    }
    navigate(`/login?returnUrl=${encodeURIComponent(bookPath)}`);
  };

  /* Arrow keys, Home and End move between FAQ questions */
  const onFaqKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const last = allFaqs.length - 1;
    let next: number | null = null;

    if (e.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;

    if (next !== null) {
      e.preventDefault();
      faqButtons.current[next]?.focus();
    }
  };

  /* Tabs: Left/Right, Home and End move between tabs (roving tabindex) */
  const onTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const last = tabs.length - 1;
    let next: number | null = null;

    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;

    if (next !== null) {
      e.preventDefault();
      setActiveTab(tabs[next].id);
      tabButtons.current[next]?.focus();
    }
  };

  /* ======================= Tab content ======================= */

  const aboutContent = (
    <section>
      <h2 className="text-2xl font-extrabold tracking-tight text-[#11104f] sm:text-3xl">
        About this service
      </h2>
      <p className="mt-3 max-w-prose text-base leading-7 text-[#55556f]">
        {service.description}
      </p>

      <h3 className="mt-10 text-lg font-extrabold text-[#11104f]">
        Why book with us
      </h3>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {trustPoints.map(({ icon: Icon, title, text }) => (
          <li
            key={title}
            className="group flex items-start gap-4 rounded-3xl border border-[#e9ebf7] bg-white p-5 transition motion-safe:hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(17,16,79,0.08)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#eef2ff] to-[#e0e7ff] text-[#4338ca]">
              <Icon size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-extrabold text-[#11104f]">
                {title}
              </span>
              <span className="mt-1 block text-sm leading-5 text-[#6b6b8a]">
                {text}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );

  const includedContent = (
    <section>
      <h2 className="text-2xl font-extrabold tracking-tight text-[#11104f] sm:text-3xl">
        What's included
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.75rem] border border-[#bfe8cf] bg-gradient-to-br from-[#effaf3] to-[#e2f6ea] p-6">
          <h3 className="text-base font-extrabold text-[#166534]">Included</h3>
          {service.inclusions.length === 0 ? (
            <p className="mt-4 text-sm text-[#166534]/80">
              Details will be shared when you book.
            </p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {service.inclusions.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm font-medium text-[#11104f]"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white">
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="sr-only">Included: </span>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[1.75rem] border border-[#e9ebf7] bg-white p-6">
          <h3 className="text-base font-extrabold text-[#11104f]">
            Not included
          </h3>
          {service.exclusions.length === 0 ? (
            <p className="mt-4 text-sm text-[#6b6b8a]">
              Nothing listed.
            </p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {service.exclusions.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-[#6b6b8a]"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eeeef5] text-[#8b8ba7]">
                    <X size={14} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="sr-only">Not included: </span>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Add-ons (read-only here; chosen later while booking) */}
      <h2 className="mt-12 text-2xl font-extrabold tracking-tight text-[#11104f] sm:text-3xl">
        Add-ons
      </h2>

      {service.addOns.length === 0 ? (
        <p className="mt-3 text-sm text-[#6b6b8a]">
          No add-ons are available for this service.
        </p>
      ) : (
        <>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {service.addOns.map((addOn) => (
              <li
                key={addOn.id}
                className="flex items-center gap-4 rounded-3xl border border-[#e9ebf7] bg-white p-5 transition hover:border-[#c7d2fe] hover:shadow-[0_12px_32px_rgba(67,56,202,0.10)]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4338ca]"
                >
                  <Plus size={18} strokeWidth={2.5} />
                </span>
                <p className="min-w-0 flex-1 text-sm font-extrabold text-[#11104f]">
                  {addOn.name}
                </p>
                <span className="shrink-0 rounded-full bg-[#ede9fe] px-3 py-1 text-sm font-extrabold tabular-nums text-[#4338ca]">
                  + {formatPrice(addOn.price)}
                </span>
              </li>
            ))}
          </ul>
          {/* CHANGED: text-[#8b8ba7] -> text-[#6b6b8a] (contrast) */}
          <p className="mt-4 text-sm text-[#6b6b8a]">
            You can choose add-ons while booking.
          </p>
        </>
      )}
    </section>
  );

  const faqsContent = (
    <section>
      <h2 className="text-2xl font-extrabold tracking-tight text-[#11104f] sm:text-3xl">
        Questions people ask
      </h2>

      <div className="mt-5 space-y-3">
        {allFaqs.map((faq, index) => {
          const open = openFaq === index;
          const buttonId = `${faqBaseId}-faq-btn-${index}`;
          const panelId = `${faqBaseId}-faq-panel-${index}`;

          return (
            <div
              key={faq.id}
              className={`rounded-3xl border bg-white transition ${
                open
                  ? "border-[#c7d2fe] shadow-[0_12px_32px_rgba(67,56,202,0.10)]"
                  : "border-[#e9ebf7]"
              }`}
            >
              <h3>
                <button
                  ref={(el) => {
                    faqButtons.current[index] = el;
                  }}
                  id={buttonId}
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpenFaq(open ? null : index)}
                  onKeyDown={(e) => onFaqKeyDown(e, index)}
                  className={`flex w-full items-center justify-between gap-4 rounded-3xl px-6 py-5 text-left text-sm font-extrabold text-[#11104f] sm:text-base ${focusRing}`}
                >
                  {faq.question}
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
                      open
                        ? "bg-[#4338ca] text-white"
                        : "bg-[#eef2ff] text-[#4338ca]"
                    }`}
                  >
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`transition ${open ? "rotate-180" : ""}`}
                    />
                  </span>
                </button>
              </h3>

              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!open}
              >
                <p className="max-w-prose px-6 pb-6 text-sm leading-7 text-[#55556f] sm:text-base">
                  {faq.answer}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderReviews = () => {
    const { summary, reviews } = reviewsQuery;

    if (!summary || summary.count === 0) {
      return (
        <section>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#11104f] sm:text-3xl">
            Reviews
          </h2>
          <p className="mt-4 rounded-3xl border border-[#e9ebf7] bg-white p-6 text-sm text-[#6b6b8a]">
            No reviews yet. Reviews appear here after customers complete a
            booking.
          </p>
        </section>
      );
    }

    return (
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#11104f] sm:text-3xl">
          Reviews
        </h2>

        {/* Average + star breakdown */}
        <div className="mt-5 grid gap-8 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#11104f] via-[#2a2593] to-[#4338ca] p-7 text-white sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="text-center sm:pr-8">
            <p className="text-6xl font-extrabold tracking-tight">
              {summary.average.toFixed(1)}
            </p>
            <div className="mt-3 flex justify-center">
              <Stars
                value={summary.average}
                size={20}
                label={`Average rating ${summary.average.toFixed(1)} out of 5`}
                emptyClass="text-white/30"
              />
            </div>
            <p className="mt-2 text-sm text-white/70">
              Based on {summary.count} review{summary.count === 1 ? "" : "s"}
            </p>
          </div>

          <ul className="space-y-2.5">
            {(["5", "4", "3", "2", "1"] as const).map((star) => {
              const count = summary.distribution[star] ?? 0;
              const percent = summary.count
                ? Math.round((count / summary.count) * 100)
                : 0;
              return (
                <li
                  key={star}
                  aria-label={`${star} stars: ${count} reviews, ${percent} percent`}
                  className="flex items-center gap-3 text-xs text-white/75"
                >
                  <span
                    className="w-10 shrink-0 font-bold text-white"
                    aria-hidden="true"
                  >
                    {star} ★
                  </span>
                  <span
                    className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-[#ffb36b] to-[#ff8a3d]"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                  <span
                    className="w-10 shrink-0 text-right tabular-nums"
                    aria-hidden="true"
                  >
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Review list (author and comment are API strings: rendered as plain text only) */}
        <ul className="mt-5 space-y-4">
          {reviews.map((review) => (
            <li key={review.id}>
              <article className="rounded-3xl border border-[#e9ebf7] bg-white p-6 transition hover:shadow-[0_12px_32px_rgba(17,16,79,0.07)]">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#4338ca] to-[#6d5dfc] text-sm font-extrabold text-white"
                    >
                      {review.author.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-[#11104f]">
                        {review.author}
                      </p>
                      {/* CHANGED: text-[#8b8ba7] -> text-[#6b6b8a] (contrast) */}
                      <time
                        dateTime={review.createdAt}
                        className="text-xs text-[#6b6b8a]"
                      >
                        {formatReviewDate(review.createdAt)}
                      </time>
                    </div>
                  </div>

                  <Stars
                    value={review.rating}
                    size={14}
                    label={`${review.rating} out of 5 stars`}
                  />
                </header>

                {review.comment && (
                  <p className="mt-4 max-w-prose text-sm leading-7 text-[#55556f] sm:text-base">
                    {review.comment}
                  </p>
                )}

                {review.verified && (
                  <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#f3f4ff] px-3 py-1.5 text-xs font-bold text-[#4338ca]">
                    <BadgeCheck size={14} aria-hidden="true" />
                    Verified booking: {service.name}
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>

        {reviewsQuery.hasNextPage && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => reviewsQuery.fetchNextPage()}
              disabled={reviewsQuery.isFetchingNextPage}
              className={`rounded-full border border-[#e4e7f5] bg-white px-6 py-3 text-sm font-extrabold text-[#4338ca] transition hover:bg-[#f3f4ff] disabled:opacity-60 ${focusRing}`}
            >
              {reviewsQuery.isFetchingNextPage ? "Loading..." : "Show more reviews"}
            </button>
          </div>
        )}
      </section>
    );
  };

  const reviewsError = (
    <div
      role="alert"
      className="rounded-3xl border border-[#e9ebf7] bg-white p-6 text-sm text-[#6b6b8a]"
    >
      We couldn't load the reviews.{" "}
      <button
        type="button"
        onClick={() => reviewsQuery.refetch()}
        className={`rounded font-bold text-[#4338ca] underline underline-offset-4 ${focusRing}`}
      >
        Try again
      </button>
    </div>
  );

  /* Slot banner in the booking card */
  const slotTone =
    slot.hasSlots === true
      ? { box: "border-[#bfe8cf] bg-[#effaf3]", dot: "bg-[#16a34a]", title: "text-[#166534]", text: "text-[#166534]/80", ping: true }
      : slot.hasSlots === false
        ? { box: "border-[#fde1b8] bg-[#fff8ec]", dot: "bg-[#f59e0b]", title: "text-[#92400e]", text: "text-[#92400e]/80", ping: false }
        : { box: "border-[#e4e7f5] bg-[#f6f7fd]", dot: "bg-[#8b8ba7]", title: "text-[#11104f]", text: "text-[#6b6b8a]", ping: false };

  const slotTitle =
    slot.hasSlots === true
      ? "Slots open this week"
      : slot.hasSlots === false
        ? `No slots in the next ${slot.windowDays} days`
        : "Availability shown at booking";

  /* SEO: real data only (name, price, category and rating come from
     GET /services/:slug). Image: the API photo if there is one, otherwise
     the picture this page shows, otherwise the category fallback in <Seo>. */
  const seoImage = service.media?.[0]?.url || cover;

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#f6f7fd]">
      <Seo
        title={`${service.name} | HomeCareX Home Services`}
        description={
          service.description ||
          `Book ${service.name} from verified professionals with HomeCareX.`
        }
        path={`/services/${service.slug}`}
        category={service.category.slug}
        {...(seoImage ? { image: seoImage } : {})}
        jsonLd={[
          serviceLd(service, {
            fallbackImage: seoImage,
            includeRating: hasRatings,
          }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Services", path: "/services" },
            { name: service.name, path: `/services/${service.slug}` },
          ]),
          faqLd(allFaqs),
        ]}
      />

      {/* Soft background glow behind the hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] overflow-hidden"
      >
        <div className="absolute -left-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-[#6366f1]/20 blur-3xl" />
        <div className="absolute -right-24 top-10 h-[22rem] w-[22rem] rounded-full bg-[#ff8a3d]/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f6f7fd]" />
      </div>

      <div className={pageWrap}>
        {/* ================= BREADCRUMB ================= */}
        <nav aria-label="Breadcrumb" className="mb-4 sm:mb-6">
          <ol className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-white bg-white/70 px-4 py-2 text-sm shadow-sm backdrop-blur">
            <li>
              <Link
                to="/services"
                className={`inline-flex items-center gap-1.5 rounded font-bold text-[#4338ca] transition hover:text-[#3730a3] ${focusRing}`}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Services
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={14} className="text-[#b4b4c8]" />
            </li>
            <li>
              <Link
                to={`/services?category=${encodeURIComponent(service.category.slug)}`}
                className={`rounded text-[#6b6b8a] transition hover:text-[#11104f] ${focusRing}`}
              >
                {service.category.name}
              </Link>
            </li>
            <li aria-hidden="true" className="hidden sm:block">
              <ChevronRight size={14} className="text-[#b4b4c8]" />
            </li>
            <li
              aria-current="page"
              className="hidden font-bold text-[#11104f] sm:block"
            >
              {service.name}
            </li>
          </ol>
        </nav>

        {/* ================= HERO GALLERY ================= */}
        <div className="space-y-3">
          <div className="group relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#4338ca] to-[#6366f1] shadow-[0_30px_80px_rgba(17,16,79,0.18)] sm:aspect-[16/10] lg:aspect-auto lg:h-[32rem]">
            <button
              type="button"
              disabled={total === 0}
              onClick={() => total > 0 && setLightbox(selectedIndex)}
              aria-label={
                total
                  ? `Open ${service.name} photo viewer`
                  : `${service.name} has no photos`
              }
              className={`absolute inset-0 enabled:cursor-zoom-in ${focusRing}`}
            >
              {total > 0 && (
                <img
                  src={photos[selectedIndex].url}
                  alt={safeAlt(
                    photos[selectedIndex].alt,
                    `${service.name} – photo ${selectedIndex + 1} of ${total}`,
                  )}
                  width={1280}
                  height={800}
                  loading="eager"
                     fetchPriority="high"
                  decoding="async"
                  onError={() => markFailed(photos[selectedIndex].url)}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 motion-safe:group-hover:scale-105"
                />
              )}

              {total === 0 && (
                <span className="absolute inset-0 flex items-center justify-center pb-24 text-sm font-bold text-white/70">
                  Photos coming soon
                </span>
              )}

              <span className="absolute inset-0 bg-gradient-to-t from-[#0b0a33]/85 via-[#0b0a33]/25 to-transparent" />

              {total > 0 && (
                <span className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-xs font-bold text-[#11104f] shadow-md backdrop-blur">
                  <ZoomIn size={14} aria-hidden="true" />
                  View photos ({total})
                </span>
              )}
            </button>

            {/* Share sits outside the photo button so buttons are not nested */}
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share this service"
              title={copied ? "Link copied" : "Share"}
              className={`absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#11104f] shadow-md backdrop-blur transition hover:bg-white ${focusRing}`}
            >
              {copied ? (
                <Check size={18} aria-hidden="true" />
              ) : (
                <Share2 size={18} aria-hidden="true" />
              )}
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-8">
              <span className="hidden rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white ring-1 ring-white/30 backdrop-blur sm:inline-block">
                {service.category.name}
              </span>

              <h1 className="mt-3 text-3xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-5xl">
                {service.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2.5 text-white">
                {hasRatings ? (
                  <>
                    <Stars
                      value={service.rating}
                      size={16}
                      label={`Rated ${service.rating} out of 5`}
                      emptyClass="text-white/40"
                    />
                    <span className="text-sm font-extrabold">
                      {service.rating.toFixed(1)}
                    </span>
                    <span className="text-sm text-white/80">
                      ({service.ratingCount} review
                      {service.ratingCount === 1 ? "" : "s"})
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-white/80">No reviews yet</span>
                )}
              </div>
            </div>
          </div>

          {/* Thumbnails */}
          {total > 1 && (
            <ul
              aria-label="Photo thumbnails"
              className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1"
            >
              {photos.map((photo, index) => (
                <li key={photo.url} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelected(index)}
                    aria-label={`Show photo ${index + 1} of ${total}`}
                    aria-pressed={index === selectedIndex}
                    className={`block aspect-[3/2] w-24 overflow-hidden rounded-2xl border-2 bg-[#eef2ff] transition sm:w-28 lg:w-36 ${focusRing} ${
                      index === selectedIndex
                        ? "border-[#4338ca] shadow-lg shadow-[#4338ca]/25"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={safeAlt(photo.alt, `${service.name} thumbnail ${index + 1}`)}
                      width={96}
                      height={64}
                      loading="lazy"
                      decoding="async"
                      onError={() => markFailed(photo.url)}
                      className="h-full w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ================= QUICK FACTS =================
            CHANGED: was <dl>/<dt>/<dd> with extra wrapper elements (invalid for
            screen readers and Lighthouse). Now a plain list; label text is darker. */}
        <ul className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-[#e4e7f5] shadow-[0_12px_32px_rgba(17,16,79,0.06)] lg:grid-cols-4">
          {[
            { icon: CalendarCheck, label: "Earliest slot", value: earliest },
            { icon: Clock, label: "Duration", value: duration },
            { icon: Wallet, label: "Payment", value: "After the service" },
            { icon: ShieldCheck, label: "Cancellation", value: "Free before arrival" },
          ].map(({ icon: Icon, label, value }) => (
            <li key={label} className="flex items-center gap-3 bg-white px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4338ca]">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-[#6b6b8a]">{label}</p>
                <p className="truncate text-sm font-extrabold text-[#11104f]">
                  {value}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* ================= TWO COLUMNS: tabs (left) + booking card (right) ================= */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
          {/* ---------- RIGHT: BOOKING CARD (desktop only) ---------- */}
          <aside className="hidden lg:order-2 lg:sticky lg:top-6 lg:block">
            <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(17,16,79,0.16)] ring-1 ring-[#e4e7f5]">
              <div className="relative bg-gradient-to-br from-[#11104f] via-[#2a2593] to-[#4338ca] p-8 text-white">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#ff8a3d]/30 blur-2xl"
                />
                <div className="relative">
                  <p className="text-base text-white/70">Starting at</p>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="text-6xl font-extrabold tracking-tight">
                      {formatPrice(service.basePrice)}
                    </p>
                    <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-base font-bold ring-1 ring-white/20">
                      <Clock size={18} aria-hidden="true" />
                      <span className="sr-only">Duration: </span>
                      {duration}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    {hasRatings ? (
                      <>
                        <Stars
                          value={service.rating}
                          size={22}
                          label={`Rated ${service.rating} out of 5`}
                          emptyClass="text-white/30"
                        />
                        <span className="text-lg font-extrabold">
                          {service.rating.toFixed(1)}
                        </span>
                        <button
                          type="button"
                          onClick={() => goToSection("reviews")}
                          aria-label={`Read all ${service.ratingCount} reviews`}
                          className="rounded text-base text-white/80 underline decoration-white/40 underline-offset-4 transition hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                        >
                          {service.ratingCount} review
                          {service.ratingCount === 1 ? "" : "s"}
                        </button>
                      </>
                    ) : (
                      <span className="text-base text-white/80">
                        No reviews yet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-7">
                <div
                  className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${slotTone.box}`}
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    {slotTone.ping && (
                      <span
                        className={`absolute inline-flex h-full w-full rounded-full opacity-50 motion-safe:animate-ping ${slotTone.dot}`}
                      />
                    )}
                    <span
                      className={`relative inline-flex h-2.5 w-2.5 rounded-full ${slotTone.dot}`}
                    />
                  </span>
                  <div>
                    <p className={`text-base font-extrabold ${slotTone.title}`}>
                      {slotTitle}
                    </p>
                    {slot.hasSlots && (
                      <p className={`text-sm ${slotTone.text}`}>
                        Earliest: {earliest}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBookNow}
                  className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#4338ca] to-[#6d5dfc] px-8 py-5 text-lg font-extrabold text-white shadow-lg shadow-[#4338ca]/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#4338ca]/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4338ca]/30"
                >
                  <CalendarCheck size={22} aria-hidden="true" />
                  Book now
                </button>

                {/* CHANGED: text-[#8b8ba7] -> text-[#6b6b8a] (contrast) */}
                <p className="mt-4 text-center text-sm text-[#6b6b8a]">
                  Pick your date, time and add-ons in the next steps.
                </p>
              </div>
            </div>
          </aside>

          {/* ---------- LEFT: TABS + CONTENT ---------- */}
          <div id="service-tabs" className="min-w-0 scroll-mt-4 lg:order-1">
            <div
              role="tablist"
              aria-label="Service sections"
              className="sticky top-2 z-20 flex gap-1 overflow-x-auto rounded-full border border-white bg-white/85 p-1.5 shadow-[0_12px_32px_rgba(17,16,79,0.08)] backdrop-blur-md"
            >
              {tabs.map((tab, index) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabButtons.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={active}
                    aria-controls="service-tabpanel"
                    tabIndex={active ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => onTabKeyDown(e, index)}
                    className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-extrabold transition ${focusRing} ${
                      active
                        ? "bg-gradient-to-r from-[#4338ca] to-[#6d5dfc] text-white shadow-md shadow-[#4338ca]/30"
                        : "text-[#6b6b8a] hover:bg-[#f3f4ff] hover:text-[#11104f]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div
              role="tabpanel"
              id="service-tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              className="pt-8"
            >
              {activeTab === "overview" && aboutContent}
              {activeTab === "included" && includedContent}
              {activeTab === "faqs" && faqsContent}
              {activeTab === "reviews" &&
                (reviewsQuery.isPending ? (
                  <ReviewSkeleton />
                ) : reviewsQuery.isError ? (
                  reviewsError
                ) : (
                  renderReviews()
                ))}
            </div>
          </div>
        </div>

        {/* ================= RELATED SERVICES ================= */}
        {related.length > 0 && (
          <section className="mt-16">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-[#11104f] sm:text-3xl">
                  You may also like
                </h2>
                <p className="mt-1 text-sm text-[#6b6b8a]">
                  More services from our trusted professionals
                </p>
              </div>

              <Link
                to="/services"
                className={`hidden items-center gap-1.5 rounded-full border border-[#e4e7f5] bg-white px-4 py-2 text-sm font-bold text-[#4338ca] transition hover:bg-[#f3f4ff] sm:inline-flex ${focusRing}`}
              >
                View all
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.id}
                  to={`/services/${encodeURIComponent(item.slug)}`}
                  className={`group overflow-hidden rounded-[1.75rem] border border-[#e9ebf7] bg-white shadow-sm transition motion-safe:hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(17,16,79,0.14)] ${focusRing}`}
                >
                  <div className="h-2 bg-gradient-to-r from-[#4338ca] to-[#6366f1]" />
                  <div className="p-5">
                    <span className="inline-block rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#4338ca]">
                      {item.category.name}
                    </span>

                    <div className="mt-3 flex items-start justify-between gap-3">
                      <h3 className="text-base font-extrabold text-[#11104f]">
                        {item.name}
                      </h3>
                      {item.ratingCount > 0 && (
                        <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-[#11104f]">
                          <Star
                            size={14}
                            fill="#ff8a3d"
                            className="text-[#ff8a3d]"
                            aria-hidden="true"
                          />
                          {item.rating.toFixed(1)}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6b6b8a]">
                      {item.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-[#f0f0f7] pt-4">
                      <span className="text-lg font-extrabold text-[#4338ca]">
                        {formatPrice(item.basePrice)}
                      </span>
                      <span className="flex items-center gap-1.5 rounded-full bg-[#f3f4ff] px-2.5 py-1 text-xs font-bold text-[#6b6b8a]">
                        <Clock size={13} aria-hidden="true" />
                        {formatDuration(item.durationMinutes)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ================= STICKY BOOK BAR (mobile and tablet) ================= */}
      <StickyBookNow
        serviceName={service.name}
        price={service.basePrice}
        onBookNow={handleBookNow}
      />

      {/* ================= PHOTO POP-UP (LIGHTBOX) ================= */}
      {lightboxPhoto && lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${service.name} photos`}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] flex flex-col bg-[#0b0a33]/95 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between px-4 py-4 sm:px-8"
          >
            <div className="text-white">
              <p className="text-sm font-extrabold">{service.name}</p>
              <p className="text-xs text-white/60">
                {lightboxIndex + 1} / {total}
              </p>
            </div>

            <button
              ref={lightboxCloseRef}
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-24">
            {total > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                aria-label="Previous photo"
                className="absolute left-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 sm:left-8"
              >
                <ChevronLeft size={26} aria-hidden="true" />
              </button>
            )}

            <img
              src={lightboxPhoto.url}
              alt={safeAlt(lightboxPhoto.alt, `${service.name} photo ${lightboxIndex + 1}`)}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-3xl object-contain shadow-2xl"
            />

            {total > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                aria-label="Next photo"
                className="absolute right-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 sm:right-8"
              >
                <ChevronRight size={26} aria-hidden="true" />
              </button>
            )}
          </div>

          {total > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="overflow-x-auto px-4 py-5"
            >
              <div className="mx-auto flex w-max gap-3">
                {photos.map((photo, index) => (
                  <button
                    key={photo.url}
                    type="button"
                    onClick={() => setLightbox(index)}
                    aria-label={`Show photo ${index + 1}`}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 ${
                      index === lightboxIndex
                        ? "border-[#ff8a3d] opacity-100"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default ServiceDetails;