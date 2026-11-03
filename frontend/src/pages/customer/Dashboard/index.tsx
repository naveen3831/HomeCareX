import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { customerPath } from "@/routes/customerPath";
import { ErrorState, OfflineState } from "@/components/customer";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCustomerDashboard, type DashboardCategoryDto } from "@/features/customer";
import { useCustomerCoupons } from "@/hooks/useCoupons";
import { useReferral } from "@/hooks/useReferral";
import DashboardSkeleton from "./sections/DashboardSkeleton";
import GreetingSection from "./sections/GreetingSection";
import SearchBar from "./sections/SearchBar";
import HeroBanner from "./sections/HeroBanner";
import ActiveBookingCard from "./sections/ActiveBookingCard";
import QuickActions from "./sections/QuickActions";
import UpcomingBookings from "./sections/UpcomingBookings";
import CategoryCard from "./sections/CategoryCard";
import RecommendedServices from "./sections/RecommendedServices";
import OffersCarousel, { type Offer } from "./sections/OffersCarousel";
import NewCustomerEmptyState from "./sections/NewCustomerEmptyState";

function SectionHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between md:mb-4">
      <h2 className="text-base font-semibold text-ink md:text-lg">{title}</h2>
      {to && (
        <Link to={to} className="text-sm font-medium text-brand hover:underline">
          View all
        </Link>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data, isPending, isError, error, refetch } = useCustomerDashboard();
  const online = useOnlineStatus();
  const { data: coupons = [], isLoading: couponsLoading } = useCustomerCoupons();
  const { data: referralData, isLoading: referralLoading } = useReferral();

  const categories = useMemo(() => {
    const rawList = data?.categories ?? [];
    const isTestOrDummy = (c: { slug?: string; name: string }) =>
      !c.name ||
      c.name.toLowerCase().includes("test") ||
      c.name.toLowerCase().includes("dummy") ||
      c.slug?.toLowerCase().includes("test") ||
      c.slug?.toLowerCase().includes("dummy");

    const seen = new Set<string>();
    const list: DashboardCategoryDto[] = [];
    for (const c of rawList) {
      if (isTestOrDummy(c)) continue;
      const key = c.id || c.slug;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(c);
    }
    return list;
  }, [data?.categories]);

  const offers = useMemo(() => {
    // 1. Map real-time coupons configured by admin in backend & database - only customer eligible offers!
    const isNew = data?.isNewCustomer;
    const eligibleCoupons = (coupons || []).filter((c) => {
      // Must be eligible according to server response
      if (c.eligible === false) return false;
      // If customer is an existing customer (has previous/active bookings), welcome/first-order coupons are not eligible
      const isWelcome = c.code.toUpperCase().includes("WELCOME") || c.code.toUpperCase().includes("FIRST");
      if (isWelcome && isNew === false) return false;
      return true;
    });

    const list: Offer[] = eligibleCoupons.map((c, index) => ({
      id: c.id || c.code,
      title: c.title,
      description: c.description,
      code: c.code,
      accent: index % 2 === 0 ? "brand" : "accent",
    }));

    // 2. Real-time dynamic referral card based on backend configured reward & user's referral code
    const rewardRupees =
      referralData?.rewardPerReferralPaise != null
        ? Math.round(referralData.rewardPerReferralPaise / 100)
        : 50;
    const referralCode = referralData?.code || "REFERRAL";

    list.push({
      id: "referral-reward",
      title: `Refer a friend, earn ₹${rewardRupees}`,
      description: "Both of you get wallet credit on their first booking.",
      code: referralCode,
      accent: list.length % 2 === 0 ? "brand" : "accent",
      isReferral: true,
    });

    return list;
  }, [coupons, referralData, data?.isNewCustomer]);

  if (isPending) return <DashboardSkeleton />;

  // Failed and nothing cached to fall back on. (If we already have data, a failed
  // background refetch keeps showing it — the layout's offline banner covers "you're offline".)
  if (isError || !data) {
    const noConnection = !online || error?.code === "NETWORK_ERROR";
    return noConnection ? (
      <OfflineState onRetry={() => void refetch()} />
    ) : (
      <ErrorState
        title="We couldn't load your dashboard"
        message={error?.message ?? "Please try again. If the problem continues, contact support."}
        onRetry={() => void refetch()}
      />
    );
  }

  const { activeBookings, upcomingBookings, recommendedServices, isNewCustomer } = data;

  return (
    <div className="dashboard-mobile mx-auto w-full min-w-0 max-w-[1440px] space-y-6 md:space-y-5">
      <GreetingSection firstName={data.greeting.firstName} isNewCustomer={isNewCustomer} />

      <HeroBanner categories={categories}>
        <SearchBar services={recommendedServices} />
        {recommendedServices.length > 0 && (
          <div className="hero-rise mt-4 hidden flex-wrap justify-center gap-2.5 md:flex" style={{ "--i": 4 } as CSSProperties} aria-label="Popular searches">
            {recommendedServices.slice(0, 4).map((s) => (
              <Link
                key={s.id}
                to={`${customerPath("/services")}?q=${encodeURIComponent(s.name)}`}
                className="rounded-full border border-[#D9DCF7] bg-white px-4 py-1.5 text-[13px] font-medium text-ink transition-all hover:-translate-y-0.5 hover:border-brand hover:text-brand hover:shadow-[0_12px_18px_-12px_rgba(67,56,202,.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </HeroBanner>

      {activeBookings.length > 0 && <ActiveBookingCard bookings={activeBookings} />}

      <div className="md:hidden">
        <QuickActions hasActiveBooking={activeBookings.length > 0} hasBookingHistory={!isNewCustomer} />
      </div>

      {isNewCustomer ? (
        <NewCustomerEmptyState categories={categories} />
      ) : (
        upcomingBookings.length > 0 && (
          <section className="rounded-[20px] border border-white bg-white p-4 shadow-[0_9px_26px_rgba(30,27,46,.07)] sm:p-5">
            <SectionHeader title="Upcoming" to={customerPath("/bookings")} />
            <UpcomingBookings bookings={upcomingBookings} />
          </section>
        )
      )}

      {categories.length > 0 && (
        <section className="dashboard-section dashboard-section--categories">
          <SectionHeader title="Browse categories" to={customerPath("/categories")} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
            {categories.slice(0, 6).map((c, i) => (
              // Phones keep the compact 4; wider screens show all 6.
              <div key={c.id} className={clsx(i >= 4 && "hidden md:block")}>
                <CategoryCard category={c} index={i} />
              </div>
            ))}
          </div>
        </section>
      )}

      {recommendedServices.length > 0 && (
        <section className="dashboard-section">
          <SectionHeader title="Recommended for you" />
          <RecommendedServices services={recommendedServices} />
        </section>
      )}

      {offers.length > 0 && (
        <section className="dashboard-section dashboard-section--offers">
        <SectionHeader title="Offers for you" />
        <OffersCarousel offers={offers} isLoading={couponsLoading || referralLoading} />
      </section>
      )}
    </div>
  );
}
