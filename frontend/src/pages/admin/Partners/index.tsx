import { PageSearch } from '@/components/admin/PageSearch';
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUIStore } from "@/store/useUIStore";
import DataTable, {
  Column,
} from "../../../components/tables/DataTable";

import { adminApi, type PartnerDirectoryRow } from "@/services/adminApi";

const KYC_LABEL: Record<PartnerDirectoryRow["kycStatus"], string> = {
  not_started: "Not started",
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

const ACCOUNT_LABEL: Record<PartnerDirectoryRow["accountStatus"], string> = {
  active: "Active",
  blocked: "Blocked",
  invited: "Invited",
};

// Table rows carry display labels so filters, sorting and badges keep working.
type PartnerRow = Omit<PartnerDirectoryRow, "kycStatus" | "accountStatus"> & {
  kycStatus: string;
  accountStatus: string;
};

import "./index.css";

const AdminPartnersPage: React.FC = () => {
   // Search text comes from the navbar search bar
  const search = useUIStore((state) => state.pageSearch);
  const setSearch = useUIStore((state) => state.setPageSearch);
  React.useEffect(() => { setSearch(''); }, [setSearch]);
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

  useEffect(() => {
    let live = true;
    setLoading(true);
    adminApi
      .partnerDirectory()
      .then((list) => {
        if (!live) return;
        setRows(
          list.map((p) => ({
            ...p,
            kycStatus: KYC_LABEL[p.kycStatus] ?? p.kycStatus,
            accountStatus: ACCOUNT_LABEL[p.accountStatus] ?? p.accountStatus,
          })),
        );
        setLoadError("");
      })
      .catch((e: { message?: string }) => {
        if (live) setLoadError(e?.message || "Could not load partners.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const kycOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows.map(
            (partner) => partner.kycStatus
          )
        )
      ),
    [rows]
  );

  const accountOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows.map(
            (partner) => partner.accountStatus
          )
        )
      ),
    [rows]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows.map(
            (partner) => partner.category
          )
        )
      ),
    [rows]
  );

  const cityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows.map(
            (partner) => partner.city
          )
        )
      ),
    [rows]
  );

  const filteredPartners = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return rows.filter((partner) => {
      const matchesSearch =
        !searchValue ||
        partner.name
          .toLowerCase()
          .includes(searchValue) ||
        partner.email
          .toLowerCase()
          .includes(searchValue) ||
        partner.phone
          .toLowerCase()
          .includes(searchValue) ||
        partner.city
          .toLowerCase()
          .includes(searchValue);

      const matchesKyc =
        !kycStatus ||
        partner.kycStatus === kycStatus;

      const matchesAccount =
        !accountStatus ||
        partner.accountStatus === accountStatus;

      const matchesCategory =
        !category ||
        partner.category === category;

      const matchesCity =
        !city ||
        partner.city === city;

      const matchesRating =
        !rating ||
        partner.rating >= Number(rating);

      const matchesAcceptance =
        !acceptance ||
        partner.acceptance >= Number(acceptance);

      const matchesCompletion =
        !completion ||
        partner.completion >= Number(completion);

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
    search,
    kycStatus,
    accountStatus,
    category,
    city,
    rating,
    acceptance,
    completion,
  ]);

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
    },

    {
      key: "kycStatus",
      header: "KYC Status",
      sortValue: (row) => row.kycStatus,
      cell: (row) => (
        <span
          className={`partner-status ${row.kycStatus.toLowerCase().replace(/\s+/g, "_")}`}
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
          className={`partner-status ${row.accountStatus.toLowerCase().replace(/\s+/g, "_")}`}
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
    },

    {
      key: "rating",
      header: "Rating",
      sortValue: (row) => row.rating,
      cell: (row) => (
        <span className="partner-rating">
          {row.rating.toFixed(1)}
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

    // --------------------------------------------------
    // VIEW DETAILS
    // --------------------------------------------------
    {
      key: "details",
      header: "Details",
      cell: (row) => (
        <Link
          to={`/admin/partners/${row.id}`}
          className="partner-view-btn"
        >
          View
        </Link>
      ),
    },
  ];

  const resetFilters = () => {
    setSearch("");
    setKycStatus("");
    setAccountStatus("");
    setCategory("");
    setCity("");
    setRating("");
    setAcceptance("");
    setCompletion("");
  };

  const hasActiveFilters = Boolean(
    search ||
      kycStatus ||
      accountStatus ||
      category ||
      city ||
      rating ||
      acceptance ||
      completion
  );

  return (
    <div className="admin-partners-container">
      <div className="admin-partners-header">
        <div>
          <h1 className="admin-partners-title">
            Partners
          </h1>

          <p className="admin-partners-subtitle">
            Search and filter registered service partners.
          </p>
        </div>
      </div>

      <PageSearch placeholder="Search name, email, phone or city…" />

      <section
        className="partners-filters"
        aria-label="Partner filters"
      >
        

        <div className="partners-filter-grid">
          <div className="partner-filter">
            <label htmlFor="kyc-status">
              KYC Status
            </label>

            <select
              id="kyc-status"
              value={kycStatus}
              onChange={(event) =>
                setKycStatus(event.target.value)
              }
            >
              <option value="">All</option>

              {kycOptions.map((option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="partner-filter">
            <label htmlFor="account-status">
              Account Status
            </label>

            <select
              id="account-status"
              value={accountStatus}
              onChange={(event) =>
                setAccountStatus(event.target.value)
              }
            >
              <option value="">All</option>

              {accountOptions.map((option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="partner-filter">
            <label htmlFor="partner-category">
              Category
            </label>

            <select
              id="partner-category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
            >
              <option value="">All</option>

              {categoryOptions.map((option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="partner-filter">
            <label htmlFor="partner-city">
              City
            </label>

            <select
              id="partner-city"
              value={city}
              onChange={(event) =>
                setCity(event.target.value)
              }
            >
              <option value="">All</option>

              {cityOptions.map((option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="partner-filter">
            <label htmlFor="partner-rating">
              Rating
            </label>

            <select
              id="partner-rating"
              value={rating}
              onChange={(event) =>
                setRating(event.target.value)
              }
            >
              <option value="">
                Any rating
              </option>
              <option value="1">1.0+</option>
              <option value="2">2.0+</option>
              <option value="3">3.0+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>
          </div>

          <div className="partner-filter">
            <label htmlFor="partner-acceptance">
              Acceptance
            </label>

            <select
              id="partner-acceptance"
              value={acceptance}
              onChange={(event) =>
                setAcceptance(event.target.value)
              }
            >
              <option value="">Any</option>
              <option value="50">50%+</option>
              <option value="70">70%+</option>
              <option value="80">80%+</option>
              <option value="90">90%+</option>
            </select>
          </div>

          <div className="partner-filter">
            <label htmlFor="partner-completion">
              Completion
            </label>

            <select
              id="partner-completion"
              value={completion}
              onChange={(event) =>
                setCompletion(event.target.value)
              }
            >
              <option value="">Any</option>
              <option value="50">50%+</option>
              <option value="70">70%+</option>
              <option value="80">80%+</option>
              <option value="90">90%+</option>
            </select>
          </div>

          <button
            type="button"
            className="partners-reset-btn"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            Reset filters
          </button>
        </div>
      </section>

      {loadError && (
        <p role="alert" className="partners-error">
          {loadError}
        </p>
      )}
      {loading && <p role="status">Loading partners…</p>}

      <div className="partners-table-wrapper">
        <DataTable
          columns={columns}
          data={filteredPartners}
          rowKey={(row) => row.id}
          label="Partners"
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
        Showing {filteredPartners.length} of{" "}
        {rows.length} partners
      </div>
    </div>
  );
};

export default AdminPartnersPage;