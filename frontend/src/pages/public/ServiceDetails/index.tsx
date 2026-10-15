import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import ErrorState from "../../../components/common/ErrorState";
import NotFound from "../NotFound";
import {
  categoryImage,
  formatDuration,
  formatEarliest,
  toServiceCard,
  useService,
  useServiceReviews,
  useServices,
} from "@/features/public";
import { useAuth } from "../../../hooks/useAuth"; // adjust to your real path

interface Service {
  id: string;
  /* URL-friendly name used in /services/:slug */
  slug: string;
  image: string;
  category: string;
  name: string;
  rating: number;
  price: number;
  duration: string;
  description: string;
}

/* STEP 3: optional extras the customer can add while booking */
interface AddOn {
  id: string;
  name: string;
  description?: string;
  price: number;
}

interface ServiceDetail {
  reviews: number;
  earliest: string;
  included: string[];
  notCovered: string[];
  faqs: { q: string; a: string }[];
}

type TabId = "overview" | "included" | "faqs" | "reviews";

type Faq = { q: string; a: string };

const commonFaqs: Faq[] = [
  { q: "How do I book this service?", a: "Tap Book now, pick your date and time, add any extras, and confirm. You will get a confirmation straight away." },
  { q: "How do I know the professional is verified?", a: "Every professional is background-checked and trained before joining. You can see their details before they arrive." },
  { q: "What payment methods are accepted?", a: "You pay after the service is completed. Cash and common digital payment options are accepted." },
  { q: "What if I am not happy with the work?", a: "Contact our support team within 24 hours of the service and we will arrange a fix or look into the issue." },
  { q: "Can I change the time or address after booking?", a: "Yes. You can change the slot or address before the professional is on the way, at no extra charge." },
  { q: "Will the professional arrive on time?", a: "Yes. You will get updates when the professional is on the way. If there is a delay, we will let you know." },
];

/* Review counts for 5, 4, 3, 2, 1 stars (from the reviews summary). */
type RatingBreakdown = [number, number, number, number, number];

/** Reviews shown on the Reviews tab (first page). */
const REVIEWS_LIMIT = 10;

const formatReviewDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const tabs: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "included", label: "Included & add-ons" },
  { id: "faqs", label: "FAQs" },
  { id: "reviews", label: "Reviews" },
];

const trustPoints = [
  { icon: BadgeCheck, title: "Verified professionals", text: "Background-checked and trained experts." },
  { icon: ShieldCheck, title: "Safe and reliable", text: "Quality work you can count on." },
  { icon: CalendarCheck, title: "Flexible scheduling", text: "Pick a time that suits you." },
  { icon: Headphones, title: "Customer support", text: "We're here whenever you need help." },
];

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

const ServiceDetails: React.FC = () => {
  /* STEP 1: route is /services/:slug (old SERVICE001-style ids still resolve
     and are redirected to the slug URL below) */
  const params = useParams<{ slug?: string; id?: string }>();
  const key = params.slug ?? params.id;

  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  /* Data comes from the API (or mocks when VITE_USE_MOCKS=true) */
  const serviceQuery = useService(key);
  const apiService = serviceQuery.data;

  const reviewsQuery = useServiceReviews(apiService?.id, {
    page: 1,
    limit: REVIEWS_LIMIT,
  });

  const relatedQuery = useServices(
    { limit: 12 },
    { enabled: Boolean(apiService) }
  );

  const service: Service | undefined = apiService && {
    id: apiService.id,
    slug: apiService.slug,
    image:
      apiService.media[0]?.url ||
      apiService.imageUrl ||
      categoryImage(apiService.category.slug),
    category: apiService.category.name,
    name: apiService.name,
    rating: apiService.rating,
    price: apiService.basePrice,
    duration: formatDuration(apiService.durationMinutes),
    description: apiService.description,
  };

  const detail: ServiceDetail = {
    reviews: apiService?.ratingCount ?? 0,
    earliest: apiService ? formatEarliest(apiService) : "",
    included: apiService?.inclusions ?? [],
    notCovered: apiService?.exclusions ?? [],
    faqs: (apiService?.faqs ?? []).map((f) => ({ q: f.question, a: f.answer })),
  };

  /* Add-ons for this service */
  const addOns: AddOn[] = apiService?.addOns ?? [];

  /* Star breakdown (5 -> 1) and review list */
  const summary = reviewsQuery.data?.summary;
  const breakdown: RatingBreakdown = [
    summary?.distribution["5"] ?? 0,
    summary?.distribution["4"] ?? 0,
    summary?.distribution["3"] ?? 0,
    summary?.distribution["2"] ?? 0,
    summary?.distribution["1"] ?? 0,
  ];
  const breakdownTotal = summary?.count ?? breakdown.reduce((sum, n) => sum + n, 0);

  const reviewItems = (reviewsQuery.data?.reviews ?? []).map((r) => ({
    id: r.id,
    name: r.author,
    rating: r.rating,
    date: r.createdAt.slice(0, 10),
    text: r.comment,
  }));

  const allFaqs: Faq[] = [...detail.faqs, ...commonFaqs];

  /* ---------- Photos ---------- */

  const [failed, setFailed] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);

  /* The selected tab lives in the URL (?tab=faqs), so a refresh keeps it
     and the link can be shared. No ?tab means Overview. */
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
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  /* STEP 4: ids and refs for the FAQ accordion */
  const faqBaseId = useId();
  const faqButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const lightboxCloseRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState(false);

  const gallery =
    apiService && apiService.media.length > 0
      ? apiService.media.map((m) => m.url)
      : service
        ? [service.image]
        : [];

  const photos = gallery
    .filter((src, index, all) => all.indexOf(src) === index)
    .filter((src) => !failed.includes(src));

  const markFailed = (src: string) =>
    setFailed((prev) => (prev.includes(src) ? prev : [...prev, src]));

  // Reset when the service changes
  useEffect(() => {
    setFailed([]);
    setLightbox(null);
    setSelected(0);
    setOpenFaq(0);
  }, [key]);

  // Browser tab title
  const serviceName = service?.name;
  useEffect(() => {
    if (!serviceName) return;
    const previousTitle = document.title;
    document.title = `${serviceName} | HomeCareX`;
    return () => {
      document.title = previousTitle;
    };
  }, [serviceName]);

  /* ---------- Pop-up viewer (lightbox) ---------- */

  const total = photos.length;
  const selectedIndex = Math.min(selected, Math.max(total - 1, 0));

  const lightboxIndex =
    lightbox !== null && total > 0 ? Math.min(lightbox, total - 1) : null;

  const lightboxImage = lightboxIndex !== null ? photos[lightboxIndex] : null;

  const isLightboxOpen = lightbox !== null;

  const showPrev = useCallback(
    () =>
      setLightbox((i) =>
        i === null || total === 0 ? i : (i - 1 + total) % total
      ),
    [total]
  );

  const showNext = useCallback(
    () =>
      setLightbox((i) =>
        i === null || total === 0 ? i : (i + 1) % total
      ),
    [total]
  );

  // Keyboard: Esc closes, arrows move. Page scroll is locked while open.
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

  const goToSection = (tabId: TabId) => {
    setActiveTab(tabId);
    document
      .getElementById("service-tabs")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleShare = async () => {
    if (!service) return;
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
    if (!service) return;
    const bookPath = `/customer/book/${encodeURIComponent(service.slug)}`;
    if (isAuthenticated) {
      navigate(bookPath);
      return;
    }
    navigate(`/login?returnUrl=${encodeURIComponent(bookPath)}`);
  };

  /* Loading: page skeleton while the service is fetched */
  if (serviceQuery.isLoading) {
    return (
      <main
        className="relative min-h-screen overflow-x-clip bg-[#f6f7fd]"
        role="status"
        aria-busy="true"
        aria-label="Loading service"
      >
        <div className="relative mx-auto max-w-7xl space-y-8 px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pt-10">
          <GallerySkeleton />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
            <div />
            <ServiceInfoSkeleton />
          </div>
        </div>
      </main>
    );
  }

  /* Unknown or inactive slug: public 404 page. Other failures: retry. */
  if (serviceQuery.isError) {
    if (serviceQuery.error.kind === "not_found") return <NotFound />;
    return (
      <main className="min-h-screen bg-[#f6f7fd] px-4 py-24">
        <div className="mx-auto max-w-xl">
          <ErrorState
            title="We could not load this service"
            message={serviceQuery.error.message}
            onRetry={() => void serviceQuery.refetch()}
          />
        </div>
      </main>
    );
  }

  if (!service) {
    return <NotFound />;
  }

  /* Old id URLs (/services/SERVICE001) redirect to the slug URL
     (/services/home-cleaning). The ?tab=... query is kept. */
  if (key !== service.slug) {
    const qs = searchParams.toString();
    return (
      <Navigate
        to={`/services/${service.slug}${qs ? `?${qs}` : ""}`}
        replace
      />
    );
  }

  const related = (relatedQuery.data?.items ?? [])
    .filter((item) => item.id !== service.id)
    .sort(
      (a, b) =>
        Number(b.category.id === apiService?.category.id) -
        Number(a.category.id === apiService?.category.id)
    )
    .slice(0, 3)
    .map(toServiceCard);

  /* ---------- Content for each tab ---------- */

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
        {/* STEP 3: included */}
        <div className="rounded-[1.75rem] border border-[#bfe8cf] bg-gradient-to-br from-[#effaf3] to-[#e2f6ea] p-6">
          <h3 className="text-base font-extrabold text-[#166534]">Included</h3>
          <ul className="mt-4 space-y-3.5">
            {detail.included.map((item) => (
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
        </div>

        {/* STEP 3: not included */}
        <div className="rounded-[1.75rem] border border-[#e9ebf7] bg-white p-6">
          <h3 className="text-base font-extrabold text-[#11104f]">
            Not included
          </h3>
          <ul className="mt-4 space-y-3.5">
            {detail.notCovered.map((item) => (
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
        </div>
      </div>

      {/* STEP 3: add-ons (read-only; chosen later while booking) */}
      <h2 className="mt-12 text-2xl font-extrabold tracking-tight text-[#11104f] sm:text-3xl">
        Add-ons
      </h2>

      {addOns.length === 0 ? (
        <p className="mt-3 text-sm text-[#6b6b8a]">
          No add-ons are available for this service.
        </p>
      ) : (
        <>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {addOns.map((addOn) => (
              <li
                key={addOn.id}
                className="flex items-start gap-4 rounded-3xl border border-[#e9ebf7] bg-white p-5 transition hover:border-[#c7d2fe] hover:shadow-[0_12px_32px_rgba(67,56,202,0.10)]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4338ca]"
                >
                  <Plus size={18} strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-[#11104f]">
                    {addOn.name}
                  </p>
                  {addOn.description && (
                    <p className="mt-1 text-xs leading-5 text-[#6b6b8a]">
                      {addOn.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-[#ede9fe] px-3 py-1 text-sm font-extrabold tabular-nums text-[#4338ca]">
                  + ₹{addOn.price.toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-[#8b8ba7]">
            You can choose add-ons while booking.
          </p>
        </>
      )}
    </section>
  );

  /* STEP 4: arrow keys, Home and End move between questions.
     Enter and Space already toggle, because each question is a <button>. */
  const onFaqKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
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
    index: number
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
              key={faq.q}
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
                  {faq.q}
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

              {/* Always in the page, so aria-controls always points at something */}
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!open}
              >
                <p className="max-w-prose px-6 pb-6 text-sm leading-7 text-[#55556f] sm:text-base">
                  {faq.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const reviewsContent = (
    <section>
      <h2 className="text-2xl font-extrabold tracking-tight text-[#11104f] sm:text-3xl">
        Reviews
      </h2>

      {/* STEP 5: average + breakdown */}
      <div className="mt-5 grid gap-8 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#11104f] via-[#2a2593] to-[#4338ca] p-7 text-white sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center sm:pr-8">
          <p className="text-6xl font-extrabold tracking-tight">
            {service.rating.toFixed(1)}
          </p>
          <div className="mt-3 flex justify-center">
            <Stars
              value={service.rating}
              size={20}
              label={`Average rating ${service.rating} out of 5`}
              emptyClass="text-white/30"
            />
          </div>
          <p className="mt-2 text-sm text-white/70">
            Based on {breakdownTotal} reviews
          </p>
        </div>

        <ul className="space-y-2.5">
          {breakdown.map((count, i) => {
            const stars = 5 - i;
            const percent = breakdownTotal
              ? Math.round((count / breakdownTotal) * 100)
              : 0;
            return (
              <li
                key={stars}
                aria-label={`${stars} stars: ${count} reviews, ${percent} percent`}
                className="flex items-center gap-3 text-xs text-white/75"
              >
                <span
                  className="w-10 shrink-0 font-bold text-white"
                  aria-hidden="true"
                >
                  {stars} ★
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

      {reviewItems.length === 0 && (
        <p className="mt-5 rounded-3xl border border-[#e9ebf7] bg-white p-6 text-sm text-[#6b6b8a]">
          No reviews yet. Be the first to review this service after your booking.
        </p>
      )}

      {/* Review list with date and service context */}
      <ul className="mt-5 space-y-4">
        {reviewItems.map((review) => (
          <li key={review.id}>
            <article className="rounded-3xl border border-[#e9ebf7] bg-white p-6 transition hover:shadow-[0_12px_32px_rgba(17,16,79,0.07)]">
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#4338ca] to-[#6d5dfc] text-sm font-extrabold text-white"
                  >
                    {review.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-[#11104f]">
                      {review.name}
                    </p>
                    <time
                      dateTime={review.date}
                      className="text-xs text-[#8b8ba7]"
                    >
                      {formatReviewDate(review.date)}
                    </time>
                  </div>
                </div>

                <Stars
                  value={review.rating}
                  size={14}
                  label={`${review.rating} out of 5 stars`}
                />
              </header>

              <p className="mt-4 max-w-prose text-sm leading-7 text-[#55556f] sm:text-base">
                {review.text}
              </p>

              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#f3f4ff] px-3 py-1.5 text-xs font-bold text-[#4338ca]">
                <BadgeCheck size={14} aria-hidden="true" />
                Booked: {service.name}
              </p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#f6f7fd]">
      {/* Soft background glow behind the hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] overflow-hidden"
      >
        <div className="absolute -left-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-[#6366f1]/20 blur-3xl" />
        <div className="absolute -right-24 top-10 h-[22rem] w-[22rem] rounded-full bg-[#ff8a3d]/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f6f7fd]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-32 pt-3 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16 lg:pt-10">

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
              {/* Works if your Services page reads ?category=. Otherwise
                  change this to="/services". */}
              <Link
                to={`/services?category=${encodeURIComponent(service.category)}`}
                className={`rounded text-[#6b6b8a] transition hover:text-[#11104f] ${focusRing}`}
              >
                {service.category}
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
        {(
        <div className="space-y-3">
          {/* Main photo with the service title on top */}
          <div
            className={`group relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#4338ca] to-[#6366f1] shadow-[0_30px_80px_rgba(17,16,79,0.18)] sm:aspect-[16/10] lg:aspect-auto lg:h-[32rem]`}
          >
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
                  src={photos[selectedIndex]}
                  alt={`${service.name} – photo ${selectedIndex + 1} of ${total}`}
                  width={1280}
                  height={800}
                  loading="eager"
                  decoding="async"
                  onError={() => markFailed(photos[selectedIndex])}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 motion-safe:group-hover:scale-105"
                />
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
                {service.category}
              </span>

              <h1 className="mt-3 text-3xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-5xl">
                {service.name}
              </h1>

              {/* STEP 2: rating + review count */}
              <div className="mt-3 flex flex-wrap items-center gap-2.5 text-white">
                <Stars
                  value={service.rating}
                  size={16}
                  label={`Rated ${service.rating} out of 5`}
                  emptyClass="text-white/40"
                />
                <span className="text-sm font-extrabold">{service.rating}</span>
                <span className="text-sm text-white/80">
                  ({detail.reviews} reviews)
                </span>
              </div>
            </div>
          </div>

          {/* Thumbnails (all screen sizes): lazy loaded, fixed ratio, click to change the main photo */}
          {total > 1 && (
            <ul
              aria-label="Photo thumbnails"
              className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1"
            >
              {photos.map((src, index) => (
                <li key={src} className="shrink-0">
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
                      src={src}
                      alt={`${service.name} thumbnail ${index + 1}`}
                      width={96}
                      height={64}
                      loading="lazy"
                      decoding="async"
                      onError={() => markFailed(src)}
                      className="h-full w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}

        {/* ================= QUICK FACTS ================= */}
        {(
        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-[#e4e7f5] shadow-[0_12px_32px_rgba(17,16,79,0.06)] lg:grid-cols-4">
          {[
            { icon: CalendarCheck, label: "Earliest slot", value: detail.earliest },
            { icon: Clock, label: "Duration", value: service.duration },
            { icon: Wallet, label: "Payment", value: "After the service" },
            { icon: ShieldCheck, label: "Cancellation", value: "Free before arrival" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 bg-white px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4338ca]">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-[#8b8ba7]">{label}</dt>
                <dd className="truncate text-sm font-extrabold text-[#11104f]">
                  {value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
        )}

        {/* ================= TWO COLUMNS: tabs (left) + booking card (right) ================= */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">

          {/* ---------- RIGHT: BOOKING CARD ---------- */}
          {(
          /* Desktop only: on mobile the hero, quick facts and sticky bar already show this */
          <aside className="hidden lg:order-2 lg:sticky lg:top-6 lg:block">
            <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(17,16,79,0.16)] ring-1 ring-[#e4e7f5]">

              {/* STEP 2: base price + duration */}
              <div className="relative bg-gradient-to-br from-[#eef2ff] via-[#e0e7ff] to-[#c7d2fe] p-8 text-[#11104f]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#ff8a3d]/20 blur-2xl"
                />
                <div className="relative">
                  <p className="text-base font-semibold text-[#4338ca]">Starting at</p>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="text-6xl font-extrabold tracking-tight">
                      ₹{service.price.toLocaleString("en-IN")}
                    </p>
                    <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-base font-bold text-[#4338ca] ring-1 ring-[#4338ca]/15">
                      <Clock size={18} aria-hidden="true" />
                      <span className="sr-only">Duration: </span>
                      {service.duration}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    <Stars
                      value={service.rating}
                      size={22}
                      label={`Rated ${service.rating} out of 5`}
                      emptyClass="text-[#b8bde6]"
                    />
                    <span className="text-lg font-extrabold">
                      {service.rating}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToSection("reviews")}
                      aria-label={`Read all ${detail.reviews} reviews`}
                      className="rounded text-base font-semibold text-[#4338ca] underline decoration-[#4338ca]/40 underline-offset-4 transition hover:text-[#11104f] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#6366f1]/30"
                    >
                      {detail.reviews} reviews
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-7">
                <div className="flex items-center gap-4 rounded-2xl border border-[#bfe8cf] bg-[#effaf3] px-5 py-4">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#16a34a]/50 motion-safe:animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#16a34a]" />
                  </span>
                  <div>
                    <p className="text-base font-extrabold text-[#166534]">
                      Slots open this week
                    </p>
                    <p className="text-sm text-[#166534]/80">
                      Earliest: {detail.earliest}
                    </p>
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

                <p className="mt-4 text-center text-sm text-[#8b8ba7]">
                  Pick your date, time and add-ons in the next steps.
                </p>
              </div>
            </div>
          </aside>
          )}

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
                (reviewsQuery.isLoading ? (
                <ReviewSkeleton />
              ) : reviewsQuery.isError ? (
                <div
                  role="alert"
                  className="rounded-3xl border border-red-100 bg-white p-8 text-center"
                >
                  <p className="font-bold text-[#11104f]">
                    We could not load the reviews.
                  </p>
                  <button
                    type="button"
                    onClick={() => void reviewsQuery.refetch()}
                    className={`mt-4 rounded-xl bg-[#4338ca] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#3730a3] ${focusRing}`}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                reviewsContent
              ))}
            </div>
          </div>
        </div>

        {/* ================= RELATED SERVICES ================= */}
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
                to={`/services/${item.slug}`}
                className={`group overflow-hidden rounded-[1.75rem] border border-[#e9ebf7] bg-white shadow-sm transition motion-safe:hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(17,16,79,0.14)] ${focusRing}`}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#4338ca] to-[#6366f1]">
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-700 motion-safe:group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#4338ca] shadow-sm backdrop-blur">
                    {item.category}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-extrabold text-[#11104f]">
                      {item.name}
                    </h3>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-[#11104f]">
                      <Star
                        size={14}
                        fill="#ff8a3d"
                        className="text-[#ff8a3d]"
                        aria-hidden="true"
                      />
                      {item.rating}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#f0f0f7] pt-4">
                    <span className="text-lg font-extrabold text-[#4338ca]">
                      ₹{item.price.toLocaleString("en-IN")}
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full bg-[#f3f4ff] px-2.5 py-1 text-xs font-bold text-[#6b6b8a]">
                      <Clock size={13} aria-hidden="true" />
                      {item.duration}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ================= STICKY BOOK BAR (mobile and tablet) ================= */}
      {(
        <StickyBookNow
          serviceName={service.name}
          price={service.price}
          onBookNow={handleBookNow}
        />
      )}

      {/* ================= PHOTO POP-UP (LIGHTBOX) ================= */}
      {lightboxImage && lightboxIndex !== null && (
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
              src={lightboxImage}
              alt={`${service.name} photo ${lightboxIndex + 1}`}
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
                {photos.map((src, index) => (
                  <button
                    key={src}
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
                      src={src}
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