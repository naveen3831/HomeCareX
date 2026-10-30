import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useServices } from "@/hooks/useServices";
import { useCategories } from "@/features/public/hooks";
import { serviceImageFor } from "@/lib/serviceImage";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import OfflineState from "@/components/common/OfflineState";
import {
  QUERY_LIMITS,
  parseServicesQuery,
  sanitizeSearchText,
  toServicesSearchParams,
  uiSortToApi,
} from "@/lib/querySanitize";
import type {
  ServiceListParams,
  ServiceSort,
} from "@/types/catalog";

import ServiceCard from "../../../components/public/ServiceCard";
import ServiceCardSkeleton from "../../../components/public/ServiceCardSkeleton";
import ServiceFilters, {
  SortOption,
} from "../../../components/public/ServiceFilters";
import Pagination from "../../../components/public/Pagination";
import Seo from "../../../components/common/Seo";
import { breadcrumbLd } from "../../../lib/jsonld";
import { slugToTitle } from "../../../lib/seo";

// ============================================================
// ITEMS PER PAGE
// ============================================================

const ITEMS_PER_PAGE = 6;

// ============================================================
// SEARCH DEBOUNCE DELAY
// ============================================================

const SEARCH_DEBOUNCE_MS = 300;

// ============================================================
// SERVICES PAGE
// ============================================================

export const ServicesPage: React.FC = () => {
  // ==========================================================
  // URL SEARCH PARAMS
  // ==========================================================

  const [searchParams, setSearchParams] =
    useSearchParams();

  // ==========================================================
  // READ VALUES FROM URL (sanitised)
  // A hand-edited URL (long q, sort=<injection>, page=-1, bad pincode)
  // can never reach the API or the UI as-is.
  // ==========================================================

  const {
    q: search,
    category,
    sort,
    page: currentPage,
    pincode,
    dirty: urlWasTampered,
  } = parseServicesQuery(searchParams);

  // Rewrite the address bar once so the URL matches what the page actually uses.
  useEffect(() => {
    if (!urlWasTampered) return;

    setSearchParams(
      toServicesSearchParams(
        { q: search, category, sort, page: currentPage, pincode },
        searchParams
      ),
      { replace: true }
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlWasTampered, searchParams]);

  // Dropdown value -> API value (price-low -> price-asc, etc.)
  const apiSort: ServiceSort = uiSortToApi(sort);

  const serviceParams: ServiceListParams = {
    q: search || undefined,
    category: category || undefined,
    sort: apiSort,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  };

  const servicesQuery = useServices(serviceParams);

  // Category dropdown: real categories in the order the admin set (falls back to the built-in list).
  const categoriesQuery = useCategories();
  const categoryOptions = (categoriesQuery.data ?? []).map((c) => ({ label: c.name, value: c.slug }));

  // Offline with nothing to show yet: React Query pauses the request, so show a clear
  // offline state instead of an endless skeleton. It refetches by itself on reconnect.
  const online = useOnlineStatus();

  const showOffline =
    !online &&
    (servicesQuery.isPending || servicesQuery.isError) &&
    !servicesQuery.data;

  const loading = servicesQuery.isPending;
  const error = servicesQuery.isError;

  const apiServices = servicesQuery.data?.items ?? [];
  const totalPages = servicesQuery.data?.meta.totalPages ?? 0;
  const safeCurrentPage = servicesQuery.data?.meta.page ?? currentPage;

  // ==========================================================
  // SEARCH INPUT
  // ==========================================================

  const [searchInput, setSearchInput] =
    useState(search);
  const [pincodeInput, setPincodeInput] =
    useState(pincode);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    setPincodeInput(pincode);
  }, [pincode]);

  // ==========================================================
  // SEARCH DEBOUNCE - 300ms
  // The URL only ever receives the sanitised text.
  // ==========================================================

  useEffect(() => {
    const cleaned = sanitizeSearchText(searchInput);

    if (cleaned === search) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSearchParams((previous) => {
        const params =
          new URLSearchParams(previous);

        if (cleaned) {
          params.set("q", cleaned);
        } else {
          params.delete("q");
        }

        params.set("page", "1");

        return params;
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // ==========================================================
  // UPDATE URL PARAMETERS
  // ==========================================================

  const updateParams = (
    updates: Record<string, string>
  ) => {
    const params =
      new URLSearchParams(searchParams);

    Object.entries(updates).forEach(
      ([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
    );

    setSearchParams(params);
  };

  // ==========================================================
  // SEARCH
  // ==========================================================

  const handleSearchChange = (
    value: string
  ) => {
    // Length cap while typing; the URL/API only ever get the sanitised text.
    setSearchInput(value.slice(0, QUERY_LIMITS.q));
  };

  // ==========================================================
  // CATEGORY
  // ==========================================================

  const handleCategoryChange = (
    value: string
  ) => {
    updateParams({
      category: value,
      page: "1",
    });
  };

  // ==========================================================
  // SORT
  // ==========================================================

  const handleSortChange = (
    value: SortOption
  ) => {
    updateParams({
      sort: value,
      page: "1",
    });
  };

  // ==========================================================
  // PINCODE
  // ==========================================================

  const handlePincodeChange = (
    value: string
  ) => {
    setPincodeInput(value);
    if (value === "" || value.length === 6) {
      updateParams({
        pincode: value,
        page: "1",
      });
    }
  };

  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const handleClear = () => {
    setSearchInput("");
    setPincodeInput("");
    setSearchParams({});
  };

  // ==========================================================
  // RETRY
  // ==========================================================

  const handleRetry = () => {
    void servicesQuery.refetch();
  };

  // ==========================================================
  // PAGE CHANGE
  // ==========================================================

  const handlePageChange = (
    page: number
  ) => {
    updateParams({
      page: String(page),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ==========================================================
  // SEO (canonical keeps ?category= only, see lib/seo.ts)
  // ==========================================================

  const categoryName = category ? slugToTitle(category) : "";

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f8f9ff] px-4 py-10 sm:px-6 lg:px-8">
      <Seo
        title={
          categoryName
            ? `${categoryName} Services | HomeCareX`
            : "All Home Services | HomeCareX"
        }
        description={
          categoryName
            ? `Book trusted ${categoryName.toLowerCase()} professionals near you. Compare prices, durations and book online with HomeCareX.`
            : "Browse and book home cleaning, plumbing, electrical, painting, appliance repair and maintenance services with HomeCareX."
        }
        category={category || undefined}
        jsonLd={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          ...(categoryName
            ? [
                {
                  name: categoryName,
                  path: `/services?category=${encodeURIComponent(category)}`,
                },
              ]
            : []),
        ])}
      />

      <div className="mx-auto max-w-7xl">

        {/* ====================================================
            PAGE HEADER
        ==================================================== */}

        <div className="mb-8 text-center">

          <p className="text-sm font-bold uppercase tracking-wider text-[#6366f1]">
            HomeCareX Services
          </p>

          <h1 className="mt-3 text-3xl font-extrabold text-[#11104f] sm:text-4xl">
            Find the right service for your home
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-gray-600">
            Browse our professional home services
            and choose the right service for your
            everyday needs.
          </p>

        </div>

        {/* ====================================================
            FILTERS
        ==================================================== */}

        <ServiceFilters
          q={searchInput}
          categories={categoryOptions}
          category={category}
          sort={sort}
          pincode={pincodeInput}

          onQueryChange={
            handleSearchChange
          }

          onCategoryChange={
            handleCategoryChange
          }

          onSortChange={
            handleSortChange
          }

          onPincodeChange={
            handlePincodeChange
          }

          onClear={handleClear}
        />

        {/* ====================================================
            RESULT COUNT
        ==================================================== */}

        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

          <p className="text-sm font-semibold text-[#6b6b8a]">

            {servicesQuery.data?.meta.total ?? 0}{" "}
            {(servicesQuery.data?.meta.total ?? 0) === 1
              ? "service"
              : "services"}{" "}
            found
          </p>

          {category && (
            <p className="text-sm font-semibold text-[#4338ca]">
              Category: {category}
            </p>
          )}

        </div>

        {/* ====================================================
            SERVICE GRID / OFFLINE / LOADING / ERROR / EMPTY
        ==================================================== */}

        {showOffline ? (

          /* ==================================================
             OFFLINE STATE
          ================================================== */

          <OfflineState onRetry={handleRetry} />

        ) : loading ? (

          /* ==================================================
             LOADING STATE
          ================================================== */

          <div
            className="
              grid
              gap-6
              sm:grid-cols-2
              lg:grid-cols-3
            "
            role="status"
            aria-busy="true"
            aria-label="Loading services"
          >

            {Array.from({
              length: 6,
            }).map((_, index) => (

              <ServiceCardSkeleton
                key={index}
              />

            ))}

          </div>

        ) : error ? (

          /* ==================================================
             ERROR STATE
          ================================================== */

          <div
            className="
              rounded-3xl
              border
              border-red-100
              bg-white
              px-6
              py-20
              text-center
              shadow-sm
            "
            role="alert"
          >

            <div className="mx-auto max-w-md">

              {/* Error Icon */}

              <div
                className="
                  mx-auto
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-full
                  bg-red-50
                  text-2xl
                "
              >
                ⚠️
              </div>

              {/* Error Title */}

              <h2
                className="
                  mt-5
                  text-xl
                  font-bold
                  text-[#11104f]
                "
              >
                Unable to load services
              </h2>

              {/* Error Message */}

              <p className="mt-2 text-gray-600">
                Something went wrong while
                loading the services. Please
                try again.
              </p>

              {/* Retry Button */}

              <button
                type="button"
                onClick={handleRetry}
                className="
                  mt-6
                  rounded-xl
                  bg-[#4338ca]
                  px-6
                  py-3
                  text-sm
                  font-bold
                  text-white
                  transition
                  hover:bg-[#3730a3]
                  focus:outline-none
                  focus:ring-2
                  focus:ring-[#4338ca]
                  focus:ring-offset-2
                "
              >
                Retry
              </button>

            </div>

          </div>

        ) : apiServices.length > 0 ? (

          /* ==================================================
             SERVICE CARDS
          ================================================== */

          <div
            className="
              grid
              gap-6
              sm:grid-cols-2
              lg:grid-cols-3
            "
          >

            {apiServices.map((service) => {
              const image = serviceImageFor(service.name);

              return (
                <ServiceCard
                  key={service.id}
                  id={service.slug}
                  image={image}
                  fallbackImage={image}
                  category={service.category.name}
                  name={service.name}
                  rating={service.rating}
                  price={service.basePrice}
                  duration={`${service.durationMinutes} min`}
                />
              );
            })}

          </div>

        ) : (

          /* ==================================================
             EMPTY STATE
          ================================================== */

          <div
            className="
              rounded-3xl
              border
              border-[#e0e7ff]
              bg-white
              px-6
              py-20
              text-center
              shadow-sm
            "
          >

            <div className="mx-auto max-w-md">

              {/* Empty Icon */}

              <div
                className="
                  mx-auto
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-full
                  bg-[#eef2ff]
                  text-2xl
                "
              >
                🔍
              </div>

              {/* Empty Title */}

              <h2
                className="
                  mt-5
                  text-xl
                  font-bold
                  text-[#11104f]
                "
              >
                No services found
              </h2>

              {/* Empty Message */}

              <p className="mt-2 text-gray-600">
                Try searching for a different
                service or selecting another
                category.
              </p>

              {/* Clear Filters */}

              <button
                type="button"
                onClick={handleClear}
                className="
                  mt-6
                  rounded-xl
                  bg-[#4338ca]
                  px-6
                  py-3
                  text-sm
                  font-bold
                  text-white
                  transition
                  hover:bg-[#3730a3]
                  focus:outline-none
                  focus:ring-2
                  focus:ring-[#4338ca]
                  focus:ring-offset-2
                "
              >
                Clear Filters
              </button>

            </div>

          </div>
        )}

        {/* ====================================================
            PAGINATION
        ==================================================== */}

        {!showOffline &&
          !loading &&
          !error &&
          apiServices.length > 0 && (

            <Pagination
              currentPage={
                safeCurrentPage
              }
              totalPages={
                totalPages
              }
              onPageChange={
                handlePageChange
              }
            />

          )}

        {/* =================================================
            SERVICES INFORMATION
        ================================================= */}

        <section className="mt-16 rounded-3xl border border-[#e0e7ff] bg-white px-6 py-10 shadow-sm sm:px-10">

          <div className="mx-auto max-w-5xl">

            <div className="text-center">

              <p className="text-sm font-bold uppercase tracking-wider text-[#6366f1]">
                Why Choose HomeCareX
              </p>

              <h2 className="mt-3 text-2xl font-extrabold text-[#11104f] sm:text-3xl">
                Professional services for every home
              </h2>

              <p className="mx-auto mt-4 max-w-3xl text-gray-600">
                HomeCareX connects you with
                trusted professionals for reliable,
                convenient, and quality home
                services.
              </p>

            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

              {/* Trusted Professionals */}

              <div className="rounded-2xl bg-[#f8f9ff] p-6">

                <h3 className="text-lg font-bold text-[#11104f]">
                  Trusted Professionals
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Get access to experienced service
                  professionals who are ready to help
                  with your everyday home needs.
                </p>

              </div>

              {/* Transparent Pricing */}

              <div className="rounded-2xl bg-[#f8f9ff] p-6">

                <h3 className="text-lg font-bold text-[#11104f]">
                  Transparent Pricing
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  View starting prices and service
                  details before choosing the right
                  service for your home.
                </p>

              </div>

              {/* Convenient Home Services */}

              <div className="rounded-2xl bg-[#f8f9ff] p-6">

                <h3 className="text-lg font-bold text-[#11104f]">
                  Convenient Home Services
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Find cleaning, plumbing,
                  electrical, appliance repair,
                  painting, and maintenance
                  services in one place.
                </p>

              </div>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default ServicesPage;