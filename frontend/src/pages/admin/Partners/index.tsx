import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SlidersHorizontal, RotateCcw } from "lucide-react";

import { PageSearch } from "@/components/admin/PageSearch";
import { useUIStore } from "@/store/useUIStore";
import DataTable, {
  type Column,
} from "../../../components/tables/DataTable";
import {
  adminApi,
  type PartnerDirectoryRow,
} from "@/services/adminApi";

import "./index.css";

const KYC_LABEL: Record<PartnerDirectoryRow["kycStatus"], string> = {
  not_started: "Not started",
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

const ACCOUNT_LABEL: Record<
  PartnerDirectoryRow["accountStatus"],
  string
> = {
  active: "Active",
  blocked: "Blocked",
  invited: "Invited",
};

type PartnerRow = Omit<
  PartnerDirectoryRow,
  "kycStatus" | "accountStatus"
> & {
  kycStatus: string;
  accountStatus: string;
};

const AdminPartnersPage: React.FC = () => {
  const navigate = useNavigate();
  const { pageSearch, setPageSearch } = useUIStore();

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [kycStatus, setKycStatus] = useState("");
  const [accountStatus, setAccountStatus] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState("");
  const [acceptance, setAcceptance] = useState("");
  const [completion, setCompletion] = useState("");

  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Clear the shared search when opening this page.
  useEffect(() => {
    setPageSearch("");
  }, [setPageSearch]);

  // Load partners from the admin API.
  useEffect(() => {
    let live = true;

    adminApi
      .partnerDirectory()
      .then((list) => {
        if (!live) return;

        setRows(
          list.map((partner) => ({
            ...partner,
            kycStatus:
              KYC_LABEL[partner.kycStatus] ?? partner.kycStatus,
            accountStatus:
              ACCOUNT_LABEL[partner.accountStatus] ??
              partner.accountStatus,
          })),
        );

        setLoadError("");
      })
      .catch((error: { message?: string }) => {
        if (live) {
          setLoadError(
            error?.message || "Could not load partners.",
          );
        }
      })
      .finally(() => {
        if (live) {
          setLoading(false);
        }
      });

    return () => {
      live = false;
    };
  }, []);

  // Dropdown options.
  const kycOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((partner) => partner.kycStatus)
            .filter(Boolean),
        ),
      ].sort(),
    [rows],
  );

  const accountOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((partner) => partner.accountStatus)
            .filter(Boolean),
        ),
      ].sort(),
    [rows],
  );

  // Split multi-category partners into individual categories.
  const categoryOptions = useMemo(
    () =>
      [
        ...new Set(
          rows.flatMap((partner) =>
            (partner.category || "")
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          ),
        ),
      ].sort(),
    [rows],
  );

  const cityOptions = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((partner) => (partner.city || "").trim())
            .filter(Boolean),
        ),
      ].sort(),
    [rows],
  );

  // Apply search and all selected filters.
  const filteredPartners = useMemo(() => {
    const searchValue = (pageSearch || "").trim().toLowerCase();

    return rows.filter((partner) => {
      const searchableValues = [
        partner.name,
        partner.email,
        partner.phone,
        partner.city,
      ];

      const matchesSearch =
        !searchValue ||
        searchableValues.some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(searchValue),
        );

      const matchesKyc =
        !kycStatus || partner.kycStatus === kycStatus;

      const matchesAccount =
        !accountStatus ||
        partner.accountStatus === accountStatus;

      const partnerCategories = (partner.category || "")
        .split(",")
        .map((value) => value.trim());

      const matchesCategory =
        !category || partnerCategories.includes(category);

      const matchesCity =
        !city || (partner.city || "").trim() === city;

      const matchesRating =
        !rating || Number(partner.rating) >= Number(rating);

      const matchesAcceptance =
        !acceptance ||
        Number(partner.acceptance) >= Number(acceptance);

      const matchesCompletion =
        !completion ||
        Number(partner.completion) >= Number(completion);

      return (
        matchesSearch &&
        matchesKyc &&
        matchesAccount &&
        matchesCategory &&
        matchesCity &&
        matchesRating &&
        matchesAcceptance &&
        matchesCompletion
      );
    });
  }, [
    rows,
    pageSearch,
    kycStatus,
    accountStatus,
    category,
    city,
    rating,
    acceptance,
    completion,
  ]);

  const activeFilterCount = [
    kycStatus,
    accountStatus,
    category,
    city,
    rating,
    acceptance,
    completion,
  ].filter(Boolean).length;

  const hasActiveFilters =
    Boolean((pageSearch || "").trim()) || activeFilterCount > 0;

  const resetFilters = () => {
    setPageSearch("");
    setKycStatus("");
    setAccountStatus("");
    setCategory("");
    setCity("");
    setRating("");
    setAcceptance("");
    setCompletion("");
  };

  const columns: Column<PartnerRow>[] = [
    {
      key: "name",
      header: "Partner",
      sortValue: (row) => row.name,
    },
    {
      key: "email",
      header: "Email",
      sortValue: (row) => row.email,
      cell: (row) => <span title={row.email}>{row.email}</span>,
    },
    {
      key: "kycStatus",
      header: "KYC Status",
      sortValue: (row) => row.kycStatus,
      cell: (row) => (
        <span
          className={`partner-status ${row.kycStatus
            .toLowerCase()
            .replace(/\s+/g, "_")}`}
        >
          {row.kycStatus}
        </span>
      ),
    },
    {
      key: "accountStatus",
      header: "Account Status",
      sortValue: (row) => row.accountStatus,
      cell: (row) => (
        <span
          className={`partner-status ${row.accountStatus
            .toLowerCase()
            .replace(/\s+/g, "_")}`}
        >
          {row.accountStatus}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortValue: (row) => row.category,
    },
    {
      key: "city",
      header: "City",
      sortValue: (row) => row.city,
      cell: (row) => row.city || "—",
    },
    {
      key: "rating",
      header: "Rating",
      sortValue: (row) => row.rating,
      cell: (row) => (
        <span className="partner-rating">
          <span aria-hidden="true">★</span>{" "}
          {Number(row.rating).toFixed(1)}
        </span>
      ),
    },
    {
      key: "acceptance",
      header: "Acceptance",
      sortValue: (row) => row.acceptance,
      cell: (row) => `${row.acceptance}%`,
    },
    {
      key: "completion",
      header: "Completion",
      sortValue: (row) => row.completion,
      cell: (row) => `${row.completion}%`,
    },
    {
      key: "details",
      header: "Details",
      cell: (row) => (
        <Link
          to={`/admin/partners/${row.id}`}
          className="partner-view-btn"
          onClick={(event) => event.stopPropagation()}
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <main className="admin-partners-container">
      {/* Page heading */}
      <header className="admin-partners-header">
        <div>
          <h1 className="admin-partners-title">Partners</h1>
          <p className="admin-partners-subtitle">
            Search and filter registered service partners.
          </p>
        </div>
      </header>

      {/* Full-width search with icon-only filter button */}
      <div className="partners-toolbar">
        <div className="partners-search">
          <PageSearch
            placeholder="Search name, email, phone or city..."
          />
        </div>

        <button
          type="button"
          className={`partners-filter-toggle ${
            filtersOpen ? "is-open" : ""
          }`}
          onClick={() => setFiltersOpen((open) => !open)}
          aria-label={
            filtersOpen ? "Hide partner filters" : "Show partner filters"
          }
          title="Filters"
          aria-expanded={filtersOpen}
          aria-controls="partners-filter-panel"
        >
          <SlidersHorizontal size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Collapsible filters */}
      {filtersOpen && (
        <section
          id="partners-filter-panel"
          className="partners-filter-panel"
          aria-label="Partner filters"
        >
          <div className="partners-filter-panel-header">
            <div className="partners-filter-heading">
              <h2>Filter partners</h2>
              <p>
                Choose one or more filters to narrow the results.
              </p>
            </div>

            <button
              type="button"
              className="partners-reset-btn"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Reset filters</span>
            </button>
          </div>

          <div className="partners-filter-grid">
            <div className="partner-filter">
              <label htmlFor="kyc-status">KYC Status</label>
              <select
                id="kyc-status"
                value={kycStatus}
                onChange={(event) =>
                  setKycStatus(event.target.value)
                }
              >
                <option value="">All</option>
                {kycOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="partner-filter">
              <label htmlFor="account-status">Account Status</label>
              <select
                id="account-status"
                value={accountStatus}
                onChange={(event) =>
                  setAccountStatus(event.target.value)
                }
              >
                <option value="">All</option>
                {accountOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="partner-filter">
              <label htmlFor="partner-category">Category</label>
              <select
                id="partner-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
              >
                <option value="">All</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="partner-filter">
              <label htmlFor="partner-city">City</label>
              <select
                id="partner-city"
                value={city}
                onChange={(event) =>
                  setCity(event.target.value)
                }
              >
                <option value="">All</option>
                {cityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="partner-filter">
              <label htmlFor="partner-rating">Rating</label>
              <select
                id="partner-rating"
                value={rating}
                onChange={(event) =>
                  setRating(event.target.value)
                }
              >
                <option value="">Any rating</option>
                <option value="1">1.0 and above</option>
                <option value="2">2.0 and above</option>
                <option value="3">3.0 and above</option>
                <option value="4">4.0 and above</option>
                <option value="4.5">4.5 and above</option>
              </select>
            </div>

            <div className="partner-filter">
              <label htmlFor="partner-acceptance">Acceptance</label>
              <select
                id="partner-acceptance"
                value={acceptance}
                onChange={(event) =>
                  setAcceptance(event.target.value)
                }
              >
                <option value="">Any</option>
                <option value="50">50% and above</option>
                <option value="70">70% and above</option>
                <option value="80">80% and above</option>
                <option value="90">90% and above</option>
              </select>
            </div>

            <div className="partner-filter">
              <label htmlFor="partner-completion">Completion</label>
              <select
                id="partner-completion"
                value={completion}
                onChange={(event) =>
                  setCompletion(event.target.value)
                }
              >
                <option value="">Any</option>
                <option value="50">50% and above</option>
                <option value="70">70% and above</option>
                <option value="80">80% and above</option>
                <option value="90">90% and above</option>
              </select>
            </div>
          </div>

          <div className="partners-filter-panel-footer">
            <span className="partners-filter-result">
              <strong>{filteredPartners.length}</strong>{" "}
              {filteredPartners.length === 1 ? "partner" : "partners"}{" "}
              match your filters
            </span>

            <button
              type="button"
              className="partners-apply-btn"
              onClick={() => setFiltersOpen(false)}
            >
              Done
            </button>
          </div>
        </section>
      )}

      {/* API error */}
      {loadError && (
        <p role="alert" className="partners-error">
          {loadError}
        </p>
      )}

      {/* Loading state */}
      {loading && (
        <div className="partners-loading" role="status">
          <span className="partners-loading-spinner" />
          <span>Loading partners…</span>
        </div>
      )}

      {/* Results table */}
      <section className="partners-results">
        <div className="partners-results-header">
          <div>
            <h2>Partner directory</h2>
            <p>
              {filteredPartners.length}{" "}
              {filteredPartners.length === 1 ? "partner" : "partners"}{" "}
              found
            </p>
          </div>
        </div>

        <div className="partners-table-wrapper">
          <DataTable
            columns={columns}
            data={filteredPartners}
            rowKey={(row) => row.id}
            label="Partners"
            onRowClick={(row) => navigate(`/admin/partners/${row.id}`)}
            defaultPageSize={10}
            pageSizeOptions={[5, 10, 20, 50]}
            emptyTitle="No partners found"
            emptyMessage={
              loadError
                ? "Partners could not be loaded."
                : hasActiveFilters
                  ? "No partners match the selected filters."
                  : "There are no partners to display."
            }
          />
        </div>

        <div className="partners-count">
          Showing <strong>{filteredPartners.length}</strong> of{" "}
          <strong>{rows.length}</strong> partners
        </div>
      </section>
    </main>
  );
};

export default AdminPartnersPage;
