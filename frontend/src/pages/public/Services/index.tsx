import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import ServiceCard from "../../../components/public/ServiceCard";

import ServiceCardSkeleton from "../../../components/public/ServiceCardSkeleton";

import ServiceFilters, {
  SortOption,
} from "../../../components/public/ServiceFilters";

import Pagination from "../../../components/public/Pagination";

import { toServiceCard, useCategories, useServices } from "@/features/public";
import { useHiddenPageScrollbar } from "@/hooks/useHiddenPageScrollbar";
import type { ServicesParams } from "@/features/public";

// ============================================================
// SORT: page option values -> API sort values
// ============================================================

const SORT_TO_API: Record<SortOption, NonNullable<ServicesParams["sort"]>> = {
  popular: "popular",
  "price-low": "price-asc",
  "price-high": "price-desc",
};

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
  // Hide the right-side page scrollbar (the page still scrolls normally)
  useHiddenPageScrollbar();

  // ==========================================================
  // URL SEARCH PARAMS
  // ==========================================================

  const [searchParams, setSearchParams] =
    useSearchParams();

  // ==========================================================
  // READ VALUES FROM URL
  // ==========================================================

  const search =
    searchParams.get("q") ?? "";

  const category =
    searchParams.get("category") ?? "";

  const sort =
    (searchParams.get("sort") as SortOption) ||
    "popular";

  const pincode =
    searchParams.get("pincode") ?? "";

  const currentPageValue =
    Number(searchParams.get("page")) || 1;

  const currentPage =
    currentPageValue < 1
      ? 1
      : currentPageValue;

  // ==========================================================
  // SEARCH INPUT
  // ==========================================================

  const [searchInput, setSearchInput] =
    useState(search);

  // ==========================================================
  // DATA - services come from the API (or mocks when VITE_USE_MOCKS=true)
  // ==========================================================

  const {
    data,
    isLoading: loading,
    isError: error,
    refetch,
  } = useServices({
    q: search.trim() || undefined,
    category: category || undefined,
    sort: SORT_TO_API[sort] ?? "popular",
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  });

  const { data: categoryList } = useCategories();

  const categoryOptions = useMemo(
    () => categoryList?.map((c) => ({ value: c.slug, label: c.name })),
    [categoryList]
  );

  const categoryLabel =
    categoryList?.find((c) => c.slug === category)?.name ?? category;

  const paginatedServices = useMemo(
    () => (data?.items ?? []).map(toServiceCard),
    [data]
  );

  const totalCount = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));

  // ==========================================================
  // KEEP SEARCH BOX IN SYNC WITH URL
  // ==========================================================

  useEffect(() => {
    document.title = "Services | HomeCareX";
  }, []);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // ==========================================================
  // SEARCH DEBOUNCE - 300ms
  // ==========================================================

  useEffect(() => {
    if (searchInput === search) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSearchParams((previous) => {
        const params =
          new URLSearchParams(previous);

        if (searchInput) {
          params.set("q", searchInput);
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
    setSearchInput(value);
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
    updateParams({
      pincode: value,
      page: "1",
    });
  };

  // ==========================================================
  // CLEAR FILTERS
  // ==========================================================

  const handleClear = () => {
    setSearchInput("");
    setSearchParams({});
  };

  // ==========================================================
  // RETRY
  // ==========================================================

  const handleRetry = () => {
    void refetch();
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
  // UI
  // ==========================================================

  return (
    <main className="min-h-screen bg-[#f8f9ff] px-4 py-10 sm:px-6 lg:px-8">

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
          category={category}
          categories={categoryOptions}
          sort={sort}
          pincode={pincode}

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

            {totalCount}{" "}

            {totalCount === 1
              ? "service"
              : "services"}

            {" "}found

          </p>

          {category && (
            <p className="text-sm font-semibold text-[#4338ca]">
              Category: {categoryLabel}
            </p>
          )}

        </div>

        {/* ====================================================
            SERVICE GRID / LOADING / ERROR / EMPTY
        ==================================================== */}

        {loading ? (

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

        ) : paginatedServices.length > 0 ? (

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

            {paginatedServices.map(
              (service) => (

                <ServiceCard
                  key={service.id}
                  id={service.slug}
                  image={service.image}
                  category={service.category}
                  name={service.name}
                  rating={service.rating}
                  price={service.price}
                  duration={service.duration}
                />

              )
            )}

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

        {!loading &&
          !error &&
          paginatedServices.length > 0 && (

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