import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "@/lib/http";
import "./index.css";

type BatchStatus = "Pending" | "Processing" | "Completed" | "Failed";
type PayoutStatus = "Pending" | "Processing" | "Paid" | "Failed";

interface PayoutBatch {
  id: string;
  periodStart: string;
  periodEnd: string;
  gross: number;
  commission: number;
  net: number;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  payoutIds: string[];
  raw: Record<string, unknown>;
}

interface IndividualPayout {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  amount: number;
  gross: number;
  commission: number;
  servicesCount: number;
  status: PayoutStatus;
  paidAt: string;
  createdAt: string;
  raw: Record<string, unknown>;
}

interface PayoutServiceLine {
  earningId: string;
  bookingId: string;
  serviceName: string;
  gross: number;
  commission: number;
  net: number;
  earnedAt: string;
}

interface PayoutDay {
  date: string;
  servicesCount: number;
  gross: number;
  commission: number;
  net: number;
  services: PayoutServiceLine[];
}

interface PayoutDetails {
  days: PayoutDay[];
  totals: {
    servicesCount: number;
    gross: number;
    commission: number;
    net: number;
  };
}

type WalletTxType = "commission" | "partner_payout";

interface WalletTransaction {
  id: string;
  type: WalletTxType;
  amount: number;
  description: string;
  batchId: string;
  partnerName: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

const normalizeWalletTx = (item: unknown): WalletTransaction => {
  const raw = asObject(item);

  return {
    id: firstValue(raw.id, raw._id),
    type: raw.type === "partner_payout" ? "partner_payout" : "commission",
    amount: Number(raw.amount ?? 0),
    description: firstValue(raw.description),
    batchId: firstValue(raw.batchId),
    partnerName: firstValue(raw.partnerName, "Partner"),
    periodStart: firstValue(raw.periodStart),
    periodEnd: firstValue(raw.periodEnd),
    createdAt: firstValue(raw.createdAt),
  };
};

interface AdminWalletSummary {
  commission: number;
  paidToPartners: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const PAGE_SIZE = 20;

const asObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};

const firstValue = (...values: unknown[]): string => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  return "";
};

const getErrorMessage = (error: unknown): string => {
  const root = asObject(error);
  const response = asObject(root.response);
  const data = asObject(response.data);

  return firstValue(
    data.message,
    data.error,
    root.message,
    "Something went wrong. Please try again."
  );
};

/**
 * Supports Axios responses and APIs that return a nested data object.
 */
const getPayload = (response: unknown): unknown => {
  const root = asObject(response);
  const body = root.data ?? response;
  const bodyObject = asObject(body);

  return bodyObject.data ?? body;
};

const extractArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value;
  }

  const payload = asObject(value);

  for (const key of [
    "items",
    "payouts",
    "batches",
    "results",
    "records",
  ]) {
    if (Array.isArray(payload[key])) {
      return payload[key] as unknown[];
    }
  }

  return [];
};

const normalizeBatchStatus = (value: unknown): BatchStatus => {
  const status = String(value ?? "").toLowerCase();

  if (
    ["completed", "complete", "paid", "success", "successful"].includes(
      status
    )
  ) {
    return "Completed";
  }

  if (
    ["processing", "in_progress", "initiated"].includes(status)
  ) {
    return "Processing";
  }

  if (["failed", "failure", "error"].includes(status)) {
    return "Failed";
  }

  return "Pending";
};

const normalizePayoutStatus = (value: unknown): PayoutStatus => {
  const status = String(value ?? "").toLowerCase();

  if (
    ["paid", "completed", "success", "successful"].includes(status)
  ) {
    return "Paid";
  }

  if (
    ["processing", "in_progress", "initiated"].includes(status)
  ) {
    return "Processing";
  }

  if (["failed", "failure", "error"].includes(status)) {
    return "Failed";
  }

  return "Pending";
};

const normalizeBatch = (item: unknown): PayoutBatch => {
  const raw = asObject(item);
  const period = asObject(raw.period);

  return {
    id: firstValue(raw._id, raw.id, raw.batchId),
    periodStart: firstValue(
      raw.periodStart,
      raw.startDate,
      period.from,
      period.start
    ),
    periodEnd: firstValue(
      raw.periodEnd,
      raw.endDate,
      period.to,
      period.end
    ),
    gross: Number(raw.gross ?? raw.grossAmount ?? 0),
    commission: Number(
      raw.commission ?? raw.commissionAmount ?? 0
    ),
    net: Number(raw.net ?? raw.netAmount ?? 0),
    status: normalizeBatchStatus(raw.status),
    createdAt: firstValue(raw.createdAt),
    updatedAt: firstValue(raw.updatedAt),
    payoutIds: Array.isArray(raw.payoutIds)
      ? raw.payoutIds.map((id: unknown) =>
          typeof id === "object" && id !== null
            ? firstValue(asObject(id)._id, asObject(id).id)
            : String(id)
        )
      : [],
    raw,
  };
};

const normalizePayout = (item: unknown): IndividualPayout => {
  const raw = asObject(item);
  const partner = asObject(
    raw.partnerId ?? raw.partner ?? raw.partnerDetails
  );

  const amountInPaise =
    raw.amountInPaise ??
    raw.amountPaise ??
    raw.netAmountInPaise;

  const amountValue = Number(
    amountInPaise ??
      raw.amount ??
      raw.net ??
      raw.netAmount ??
      0
  );

  const amount =
    amountInPaise != null ? amountValue / 100 : amountValue;

  const partnerId =
    typeof raw.partnerId === "object" && raw.partnerId !== null
      ? firstValue(partner._id, partner.id)
      : firstValue(
          raw.partnerId,
          partner._id,
          partner.id,
          raw.userId
        );

  return {
    id: firstValue(raw._id, raw.id, raw.payoutId),
    partnerId,
    partnerName: firstValue(
      raw.partnerName,
      partner.name,
      partner.fullName,
      partner.businessName,
      "Partner"
    ),
    partnerEmail: firstValue(raw.partnerEmail, partner.email),
    amount: Number.isFinite(amount) ? amount : 0,
    gross: Number(raw.gross ?? raw.grossAmount ?? 0),
    commission: Number(
      raw.commission ?? raw.commissionAmount ?? 0
    ),
    servicesCount: Number(raw.servicesCount ?? 0) || 0,
    status: normalizePayoutStatus(
      raw.status ?? raw.payoutStatus
    ),
    paidAt: firstValue(raw.paidAt),
    createdAt: firstValue(raw.createdAt),
    raw,
  };
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);

const formatDate = (value: string): string => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDay = (ymd: string): string => {
  const date = new Date(`${ymd}T00:00:00`);

  if (Number.isNaN(date.getTime())) return ymd || "—";

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
};

const toYmd = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

/** Monday of the current week and the following Monday (exclusive end). */
const currentWeekRange = (): { start: string; end: string } => {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);

  return { start: toYmd(monday), end: toYmd(nextMonday) };
};

const parseDetails = (response: unknown): PayoutDetails => {
  const payload = asObject(getPayload(response));
  const totals = asObject(payload.totals);

  const days: PayoutDay[] = (Array.isArray(payload.days) ? payload.days : []).map(
    (item: unknown) => {
      const day = asObject(item);

      return {
        date: firstValue(day.date),
        servicesCount: Number(day.servicesCount ?? 0),
        gross: Number(day.gross ?? 0),
        commission: Number(day.commission ?? 0),
        net: Number(day.net ?? 0),
        services: (Array.isArray(day.services) ? day.services : []).map(
          (svc: unknown) => {
            const line = asObject(svc);

            return {
              earningId: firstValue(line.earningId),
              bookingId: firstValue(line.bookingId),
              serviceName: firstValue(line.serviceName, "Service"),
              gross: Number(line.gross ?? 0),
              commission: Number(line.commission ?? 0),
              net: Number(line.net ?? 0),
              earnedAt: firstValue(line.earnedAt),
            };
          }
        ),
      };
    }
  );

  return {
    days,
    totals: {
      servicesCount: Number(totals.servicesCount ?? 0),
      gross: Number(totals.gross ?? 0),
      commission: Number(totals.commission ?? 0),
      net: Number(totals.net ?? 0),
    },
  };
};

const shortId = (value: string, length = 18): string => {
  if (!value) return "—";

  return value.length <= length
    ? value
    : `${value.slice(0, 8)}…${value.slice(-5)}`;
};

const statusClass = (
  status: BatchStatus | PayoutStatus
): string => {
  const classes: Record<string, string> = {
    Pending: "is-pending",
    Processing: "is-processing",
    Paid: "is-paid",
    Completed: "is-paid",
    Failed: "is-failed",
  };

  return `po-chip ${classes[status] ?? classes.Pending}`;
};

const parseDate = (value: string): Date | null => {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

/** Batch periods end on an exclusive boundary, so show the last included day. */
const formatPeriod = (start: string, end: string): { range: string; year: string } => {
  const from = parseDate(start);
  const to = parseDate(end);

  if (!from || !to) return { range: "—", year: "" };

  const last = new Date(to.getTime() - 1);
  const short = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

  return {
    range: `${short(from)} – ${short(last)}`,
    year: String(last.getFullYear()),
  };
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";

export const AdminPayoutsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();

  const [batches, setBatches] = useState<PayoutBatch[]>([]);
  const [individualPayouts, setIndividualPayouts] = useState<
    IndividualPayout[]
  >([]);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 0,
  });

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [expandedPayoutId, setExpandedPayoutId] = useState("");
  const [detailsByPayout, setDetailsByPayout] = useState<
    Record<string, PayoutDetails | "loading" | "error">
  >({});
  const [confirmingBatch, setConfirmingBatch] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [weekRange, setWeekRange] = useState(currentWeekRange);
  const [adminWallet, setAdminWallet] = useState<AdminWalletSummary | null>(
    null
  );

  const loadAdminWallet = useCallback(async () => {
    try {
      const response = await http.get("/admin/payout-wallet");
      const data = asObject(getPayload(response));

      setAdminWallet({
        commission: Number(data.commission ?? 0),
        paidToPartners: Number(data.paidToPartners ?? 0),
      });
    } catch {
      setAdminWallet(null);
    }
  }, []);

  const [txFilter, setTxFilter] = useState<"commission" | "partner_payout" | "all">(
    "commission"
  );
  const [txPage, setTxPage] = useState(1);
  const [txItems, setTxItems] = useState<WalletTransaction[]>([]);
  const [txPagination, setTxPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState("");

  const loadWalletTransactions = useCallback(async () => {
    setTxLoading(true);
    setTxError("");

    try {
      const typeQuery = txFilter === "all" ? "" : `&type=${txFilter}`;
      const response = await http.get(
        `/admin/payout-wallet/transactions?page=${txPage}&limit=10${typeQuery}`
      );

      const body = asObject(asObject(response).data);
      const meta = asObject(body.meta);
      const serverPagination = asObject(meta.pagination);

      setTxItems(
        extractArray(body.data)
          .map(normalizeWalletTx)
          .filter((tx) => Boolean(tx.id))
      );
      setTxTotal(Number(meta.total ?? 0));
      setTxPagination({
        page: Number(serverPagination.page ?? txPage),
        limit: Number(serverPagination.limit ?? 10),
        total: Number(serverPagination.total ?? 0),
        pages: Number(serverPagination.pages ?? 0),
      });
    } catch (error) {
      setTxError(getErrorMessage(error));
      setTxItems([]);
    } finally {
      setTxLoading(false);
    }
  }, [txFilter, txPage]);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await http.get(
        `/admin/payouts?page=${page}&limit=${PAGE_SIZE}`
      );

      const payload = getPayload(response);
      const payloadObject = asObject(payload);

      const rows = extractArray(payload)
        .map(normalizeBatch)
        .filter((batch) => Boolean(batch.id));

      setBatches(rows);

      const serverPagination = asObject(
        payloadObject.pagination ?? payloadObject.meta
      );

      const total = Number(serverPagination.total ?? rows.length);
      const serverPage = Number(serverPagination.page ?? page);
      const limit = Number(
        serverPagination.limit ?? PAGE_SIZE
      );

      setPagination({
        page: serverPage,
        limit,
        total,
        pages: Number(
          serverPagination.pages ??
            Math.ceil(total / Math.max(1, limit))
        ),
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
      setBatches([]);

      setPagination({
        page,
        limit: PAGE_SIZE,
        total: 0,
        pages: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadBatchDetails = useCallback(async (batchId: string) => {
    setDetailLoading(true);
    setLoadError("");
    setIndividualPayouts([]);

    try {
      const response = await http.get(
        `/admin/payouts/${encodeURIComponent(batchId)}`
      );

      const payload = getPayload(response);
      const payloadObject = asObject(payload);

      const batchData =
        payloadObject.batch ??
        payloadObject.item ??
        payloadObject.data ??
        payload;

      const normalizedBatch = normalizeBatch(batchData);

      if (!normalizedBatch.id) {
        throw new Error(
          "The server returned invalid payout batch details."
        );
      }

      setBatches((current) => {
        const exists = current.some(
          (item) => item.id === normalizedBatch.id
        );

        return exists
          ? current.map((item) =>
              item.id === normalizedBatch.id
                ? normalizedBatch
                : item
            )
          : [normalizedBatch, ...current];
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
      setDetailLoading(false);
      return;
    }

    try {
      const response = await http.get(
        `/admin/payouts/${encodeURIComponent(batchId)}/payouts`
      );

      const payouts = extractArray(getPayload(response))
        .map(normalizePayout)
        .filter((payout) => Boolean(payout.id));

      setIndividualPayouts(payouts);
    } catch (error) {
      setLoadError(
        `Batch loaded, but individual payouts could not be loaded: ${getErrorMessage(error)}`
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!routeId) {
      void loadBatches();
      void loadAdminWallet();
    }
  }, [routeId, loadBatches, loadAdminWallet]);

  useEffect(() => {
    if (!routeId) {
      void loadWalletTransactions();
    }
  }, [routeId, loadWalletTransactions]);

  useEffect(() => {
    setTxPage(1);
  }, [txFilter]);

  useEffect(() => {
    if (routeId) {
      void loadBatchDetails(routeId);
    }
  }, [routeId, loadBatchDetails]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const filteredBatches = useMemo(() => {
    const query = search.trim().toLowerCase();

    return batches.filter((batch) => {
      const values = [
        batch.id,
        batch.status,
        batch.periodStart,
        batch.periodEnd,
        String(batch.gross),
        String(batch.commission),
        String(batch.net),
      ];

      const matchesSearch =
        !query ||
        values.some((value) =>
          value.toLowerCase().includes(query)
        );

      const matchesStatus =
        statusFilter === "All" ||
        batch.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [batches, search, statusFilter]);

  const pendingBatches = batches.filter(
    (batch) => batch.status === "Pending"
  );

  const processingBatches = batches.filter(
    (batch) => batch.status === "Processing"
  );

  const completedBatches = batches.filter(
    (batch) => batch.status === "Completed"
  );

  const failedBatches = batches.filter(
    (batch) => batch.status === "Failed"
  );

  const goBack = () => navigate("/admin/payouts");

  const openDetails = (batch: PayoutBatch) => {
    if (!batch.id) {
      setActionError("This payout batch does not have a valid ID.");
      return;
    }

    setActionError("");
    navigate(`/admin/payouts/${encodeURIComponent(batch.id)}`);
  };

  const exportBatchCsv = async (batchId?: string) => {
    setActionError("");
    setActionSuccess("");

    let objectUrl = "";

    try {
      const endpoint = batchId
        ? `/admin/payouts/${encodeURIComponent(batchId)}/export`
        : "/admin/payouts/export";

      const response = await http.get(endpoint, {
        responseType: "blob",
      });

      const responseData = asObject(response);
      const responseBlob = responseData.data;

      const blob =
        responseBlob instanceof Blob
          ? responseBlob
          : new Blob(
              [responseBlob as BlobPart],
              { type: "text/csv;charset=utf-8;" }
            );

      objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = batchId
        ? `homecarex-payout-batch-${batchId}.csv`
        : "homecarex-payouts.csv";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      setActionSuccess("CSV export started.");
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      if (objectUrl) {
        window.setTimeout(
          () => URL.revokeObjectURL(objectUrl),
          1000
        );
      }
    }
  };

  const toggleServices = async (payout: IndividualPayout) => {
    if (expandedPayoutId === payout.id) {
      setExpandedPayoutId("");
      return;
    }

    setExpandedPayoutId(payout.id);

    if (detailsByPayout[payout.id] && detailsByPayout[payout.id] !== "error") {
      return;
    }

    setDetailsByPayout((current) => ({ ...current, [payout.id]: "loading" }));

    try {
      const response = await http.get(
        `/admin/payout-items/${encodeURIComponent(payout.id)}/details`
      );

      setDetailsByPayout((current) => ({
        ...current,
        [payout.id]: parseDetails(response),
      }));
    } catch {
      setDetailsByPayout((current) => ({ ...current, [payout.id]: "error" }));
    }
  };

  const markPayoutPaid = async (payout: IndividualPayout) => {
    if (!payout.id || updatingId || confirmingBatch || payout.status === "Paid") {
      return;
    }

    if (
      !window.confirm(
        `Confirm payment of ${formatCurrency(payout.amount)} to ${payout.partnerName}?\n\nThis credits the partner wallet and records it in the admin wallet.`
      )
    ) {
      return;
    }

    setUpdatingId(payout.id);
    setActionError("");
    setActionSuccess("");

    try {
      await http.patch(
        `/admin/payouts/${encodeURIComponent(payout.id)}/mark-paid`,
        {}
      );

      setActionSuccess(
        `${formatCurrency(payout.amount)} credited to ${payout.partnerName}'s wallet.`
      );

      if (routeId) {
        await loadBatchDetails(routeId);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setUpdatingId("");
    }
  };

  const confirmBatchPayment = async (batchId: string) => {
    const unpaid = individualPayouts.filter((item) => item.status !== "Paid");
    const total = unpaid.reduce((sum, item) => sum + item.amount, 0);

    if (!unpaid.length || confirmingBatch || updatingId) {
      return;
    }

    if (
      !window.confirm(
        `Confirm payment of ${formatCurrency(total)} to ${unpaid.length} partner(s)?\n\nEach partner wallet will be credited and the total recorded in the admin wallet.`
      )
    ) {
      return;
    }

    setConfirmingBatch(true);
    setActionError("");
    setActionSuccess("");

    try {
      const response = await http.post(
        `/admin/payouts/${encodeURIComponent(batchId)}/confirm`,
        {}
      );

      const result = asObject(getPayload(response));
      const failed = Array.isArray(result.failed) ? result.failed : [];

      if (failed.length) {
        setActionError(
          `${failed.length} payout(s) could not be confirmed. Retry to pay the remaining ones.`
        );
      }

      setActionSuccess(
        `${formatCurrency(Number(result.confirmedAmount ?? 0))} paid to ${Number(
          result.confirmedCount ?? 0
        )} partner wallet(s).`
      );

      await loadBatchDetails(batchId);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setConfirmingBatch(false);
    }
  };

  const generateWeeklyBatch = async () => {
    if (generating) return;

    if (
      !window.confirm(
        `Generate the payout batch for ${weekRange.start} to ${weekRange.end} (end date excluded)?`
      )
    ) {
      return;
    }

    setGenerating(true);
    setActionError("");
    setActionSuccess("");

    try {
      // Business time is IST; the end date is exclusive.
      await http.post("/admin/payouts", {
        periodStart: `${weekRange.start}T00:00:00+05:30`,
        periodEnd: `${weekRange.end}T00:00:00+05:30`,
      });

      setActionSuccess("Weekly payout batch generated.");
      await loadBatches();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const renderServices = (
    details: PayoutDetails | "loading" | "error" | undefined
  ) => {
    if (!details || details === "loading") {
      return <p className="po-note">Loading services…</p>;
    }

    if (details === "error") {
      return (
        <p className="po-note is-error" role="alert">
          Could not load the services for this payout. Close and open the row to try again.
        </p>
      );
    }

    if (!details.days.length) {
      return (
        <p className="po-note">No service records are linked to this payout.</p>
      );
    }

    return (
      <div className="po-days">
        {details.days.map((day) => (
          <article key={day.date} className="po-day">
            <header className="po-day-head">
              <div>
                <strong>{formatDay(day.date)}</strong>
                <span>
                  {day.servicesCount} service{day.servicesCount === 1 ? "" : "s"}
                </span>
              </div>
              <b>{formatCurrency(day.net)}</b>
            </header>

            <ul className="po-lines">
              {day.services.map((svc) => (
                <li key={svc.earningId}>
                  <div className="po-line-name">
                    <span>{svc.serviceName}</span>
                    <small>
                      {formatTime(svc.earnedAt)}
                      {svc.earnedAt ? " · " : ""}
                      {shortId(svc.bookingId)}
                    </small>
                  </div>
                  <span className="po-line-meta">
                    {formatCurrency(svc.gross)} − {formatCurrency(svc.commission)}
                  </span>
                  <b className="po-line-net">{formatCurrency(svc.net)}</b>
                </li>
              ))}
            </ul>
          </article>
        ))}

        <p className="po-days-total">
          {details.totals.servicesCount} services this week
          <b>{formatCurrency(details.totals.net)}</b>
        </p>
      </div>
    );
  };

  const alerts = (
    <>
      {loadError && (
        <div className="po-alert is-error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            className="po-link"
            onClick={() =>
              routeId ? void loadBatchDetails(routeId) : void loadBatches()
            }
          >
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="po-alert is-error" role="alert">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="po-alert is-success" role="status">
          {actionSuccess}
        </div>
      )}
    </>
  );

  /* ------------------------------ Details page ------------------------------ */
  if (routeId) {
    const batch = batches.find((item) => item.id === routeId);

    const totalAmount = individualPayouts.length
      ? individualPayouts.reduce((sum, item) => sum + item.amount, 0)
      : batch?.net ?? 0;
    const paidList = individualPayouts.filter((item) => item.status === "Paid");
    const paidAmount = paidList.reduce((sum, item) => sum + item.amount, 0);
    const remaining = Math.max(0, totalAmount - paidAmount);
    const percent =
      totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
    const allPaid =
      individualPayouts.length > 0 && paidList.length === individualPayouts.length;
    const period = batch ? formatPeriod(batch.periodStart, batch.periodEnd) : null;

    return (
      <main className="admin-page-container payout-page">
        <div className="po-details">
          <button type="button" className="po-back" onClick={goBack}>
            <span aria-hidden="true">←</span> Payouts
          </button>

          <header className="po-head">
            <div>
              <h1>
                {period ? `Week of ${period.range}` : "Payout batch"}
                {period?.year ? <em>{period.year}</em> : null}
              </h1>
              <p className="po-sub">
                Check each partner’s services, then confirm payment to credit their wallets.
              </p>
            </div>

            {batch && (
              <div className="po-head-actions">
                <span className={statusClass(batch.status)}>
                  <i aria-hidden="true" />
                  {batch.status}
                </span>
                <button
                  type="button"
                  className="po-btn"
                  onClick={() => void exportBatchCsv(batch.id)}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="po-btn is-ink"
                  disabled={confirmingBatch || Boolean(updatingId) || allPaid || individualPayouts.length === 0}
                  onClick={() => void confirmBatchPayment(batch.id)}
                >
                  {confirmingBatch
                    ? "Confirming…"
                    : allPaid
                      ? "All partners paid"
                      : `Confirm payment · ${formatCurrency(remaining)}`}
                </button>
              </div>
            )}
          </header>

          {alerts}

          {detailLoading && (
            <section className="po-state" aria-live="polite">
              <span className="po-spinner" />
              <p>Loading batch details…</p>
            </section>
          )}

          {!detailLoading && !batch && !loadError && (
            <section className="po-state">
              <h2>Batch not found</h2>
              <p>This batch may have been removed, or the link is wrong.</p>
              <button type="button" className="po-btn" onClick={goBack}>
                Back to payouts
              </button>
            </section>
          )}

          {!detailLoading && batch && (
            <>
              <section className="po-hero" aria-label="Settlement summary">
                <div className="po-hero-main">
                  <p>Net payout to partners</p>
                  <strong>{formatCurrency(batch.net)}</strong>

                  <div
                    className="po-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    aria-label="Share of this batch already paid"
                  >
                    <span style={{ width: `${percent}%` }} />
                  </div>

                  <p className="po-hero-sub">
                    <b>{formatCurrency(paidAmount)}</b> paid ·{" "}
                    <b>{formatCurrency(remaining)}</b> to pay ·{" "}
                    {paidList.length} of {individualPayouts.length} partners
                  </p>
                </div>

                <dl className="po-equation">
                  <div>
                    <dt>Gross</dt>
                    <dd>{formatCurrency(batch.gross)}</dd>
                  </div>
                  <span aria-hidden="true">−</span>
                  <div>
                    <dt>Commission</dt>
                    <dd>{formatCurrency(batch.commission)}</dd>
                  </div>
                  <span aria-hidden="true">=</span>
                  <div>
                    <dt>Net</dt>
                    <dd>{formatCurrency(batch.net)}</dd>
                  </div>
                </dl>
              </section>

              <dl className="po-meta">
                <div>
                  <dt>Period</dt>
                  <dd>
                    {period ? `${period.range}, ${period.year}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(batch.createdAt)}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatDate(batch.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Batch ID</dt>
                  <dd className="po-mono" title={batch.id}>
                    {shortId(batch.id, 14)}
                  </dd>
                </div>
              </dl>

              <section className="po-card">
                <header className="po-card-head">
                  <div>
                    <h2>Partners</h2>
                    <p>
                      {individualPayouts.length} payout
                      {individualPayouts.length === 1 ? "" : "s"} in this batch. Open a row to see services day by day.
                    </p>
                  </div>
                </header>

                <div className="po-scroll">
                  <table className="po-table po-partners">
                    <thead>
                      <tr>
                        <th>Partner</th>
                        <th>Services</th>
                        <th className="is-num">Gross</th>
                        <th className="is-num">Commission</th>
                        <th className="is-num">Net amount</th>
                        <th>Status</th>
                        <th className="is-end">Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {individualPayouts.map((payout) => {
                        const open = expandedPayoutId === payout.id;

                        return (
                          <React.Fragment key={payout.id}>
                            <tr className={open ? "is-open" : undefined}>
                              <td>
                                <div className="po-person">
                                  <span className="po-avatar" aria-hidden="true">
                                    {initials(payout.partnerName)}
                                  </span>
                                  <span>
                                    <b>{payout.partnerName}</b>
                                    <small>
                                      {payout.partnerEmail || shortId(payout.partnerId)}
                                    </small>
                                  </span>
                                </div>
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="po-toggle"
                                  aria-expanded={open}
                                  onClick={() => void toggleServices(payout)}
                                >
                                  {payout.servicesCount || "View"} service
                                  {payout.servicesCount === 1 ? "" : "s"}
                                  <span aria-hidden="true">{open ? "▴" : "▾"}</span>
                                </button>
                              </td>

                              <td className="is-num is-muted">
                                {formatCurrency(payout.gross)}
                              </td>
                              <td className="is-num is-muted">
                                {formatCurrency(payout.commission)}
                              </td>
                              <td className="is-num is-strong">
                                {formatCurrency(payout.amount)}
                              </td>

                              <td>
                                <span className={statusClass(payout.status)}>
                                  <i aria-hidden="true" />
                                  {payout.status}
                                </span>
                                {payout.paidAt && (
                                  <small className="po-paid-at">
                                    {formatDate(payout.paidAt)}
                                  </small>
                                )}
                              </td>

                              <td className="is-end">
                                <button
                                  type="button"
                                  className={`po-btn is-small ${
                                    payout.status === "Paid" ? "is-done" : ""
                                  }`}
                                  disabled={
                                    payout.status === "Paid" ||
                                    Boolean(updatingId) ||
                                    confirmingBatch
                                  }
                                  onClick={() => void markPayoutPaid(payout)}
                                >
                                  {updatingId === payout.id
                                    ? "Confirming…"
                                    : payout.status === "Paid"
                                      ? "Paid"
                                      : "Confirm payment"}
                                </button>
                              </td>
                            </tr>

                            {open && (
                              <tr className="po-expand">
                                <td colSpan={7}>
                                  {renderServices(detailsByPayout[payout.id])}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {!detailLoading && individualPayouts.length === 0 && (
                        <tr>
                          <td colSpan={7}>
                            <div className="po-state is-inline">
                              <h2>No payouts in this batch</h2>
                              <p>The batch has no partner payouts to confirm.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    );
  }

  /* ------------------------------- List page -------------------------------- */
  return (
    <main className="admin-page-container payout-page">
      <header className="po-head">
        <div>
          <h1>Payouts</h1>
          <p className="po-sub">
            Pay partners once a week. Each batch adds up their completed services and credits their wallets when you confirm.
          </p>
        </div>

        <div className="po-head-actions">
          <button
            type="button"
            className="po-btn"
            onClick={() => {
              void loadBatches();
              void loadAdminWallet();
              void loadWalletTransactions();
            }}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="po-btn" onClick={() => void exportBatchCsv()}>
            Export all CSV
          </button>
        </div>
      </header>

      {alerts}

      <section className="po-strip" aria-label="Payout summary">
        <div>
          <span>Commission earned</span>
          <strong>{formatCurrency(adminWallet?.commission ?? 0)}</strong>
          <small>Admin wallet</small>
        </div>
        <div>
          <span>Paid to partner wallets</span>
          <strong>{formatCurrency(adminWallet?.paidToPartners ?? 0)}</strong>
          <small>All confirmed payouts</small>
        </div>
        <div>
          <span>Waiting for payment</span>
          <strong>{pendingBatches.length + processingBatches.length}</strong>
          <small>
            {pendingBatches.length} pending · {processingBatches.length} in progress
          </small>
        </div>
        <div>
          <span>Completed</span>
          <strong>{completedBatches.length}</strong>
          <small>{failedBatches.length} failed on this page</small>
        </div>
      </section>

      <section className="po-card po-generate" aria-label="Generate weekly batch">
        <div className="po-generate-copy">
          <h2>Create a weekly batch</h2>
          <p>Pick the week. The end date is not included, so Monday to next Monday covers 7 days.</p>
        </div>

        <label className="po-field">
          <span>Week start</span>
          <input
            type="date"
            value={weekRange.start}
            onChange={(event) =>
              setWeekRange((current) => ({ ...current, start: event.target.value }))
            }
          />
        </label>

        <label className="po-field">
          <span>Week end</span>
          <input
            type="date"
            value={weekRange.end}
            onChange={(event) =>
              setWeekRange((current) => ({ ...current, end: event.target.value }))
            }
          />
        </label>

        <button
          type="button"
          className="po-btn is-accent"
          disabled={generating || !weekRange.start || !weekRange.end}
          onClick={() => void generateWeeklyBatch()}
        >
          {generating ? "Generating…" : "Generate batch"}
        </button>
      </section>

      <section className="po-card">
        <div className="po-toolbar">
          <label className="po-field is-grow">
            <span className="po-sr">Search payout batches</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by batch ID, date or amount"
              aria-label="Search payout batches"
            />
          </label>

          <div className="po-tabs" role="tablist" aria-label="Filter by status">
            {["All", "Pending", "Processing", "Completed", "Failed"].map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={statusFilter === option}
                className={statusFilter === option ? "is-active" : undefined}
                onClick={() => setStatusFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="po-state" aria-live="polite">
            <span className="po-spinner" />
            <p>Loading payout batches…</p>
          </div>
        )}

        {!loading && (
          <div className="po-scroll">
            <table className="po-table po-batches">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Partners</th>
                  <th className="is-num">Gross</th>
                  <th className="is-num">Commission</th>
                  <th className="is-num">Net payout</th>
                  <th>Status</th>
                  <th className="is-end"><span className="po-sr">Open</span></th>
                </tr>
              </thead>

              <tbody>
                {filteredBatches.map((batch) => {
                  const period = formatPeriod(batch.periodStart, batch.periodEnd);

                  return (
                    <tr
                      key={batch.id}
                      className="is-clickable"
                      onClick={() => openDetails(batch)}
                    >
                      <td>
                        <div className="po-week">
                          <b>{period.range}</b>
                          <small>
                            {period.year} · Batch {shortId(batch.id, 12)}
                          </small>
                        </div>
                      </td>
                      <td>{batch.payoutIds.length || "—"}</td>
                      <td className="is-num is-muted">{formatCurrency(batch.gross)}</td>
                      <td className="is-num is-muted">{formatCurrency(batch.commission)}</td>
                      <td className="is-num is-strong">{formatCurrency(batch.net)}</td>
                      <td>
                        <span className={statusClass(batch.status)}>
                          <i aria-hidden="true" />
                          {batch.status}
                        </span>
                      </td>
                      <td className="is-end">
                        <button
                          type="button"
                          className="po-btn is-small"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetails(batch);
                          }}
                          disabled={!batch.id}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!loadError && filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="po-state is-inline">
                        <h2>
                          {batches.length === 0
                            ? "No payout batches yet"
                            : "No batches match these filters"}
                        </h2>
                        <p>
                          {batches.length === 0
                            ? "Create a weekly batch above to start paying partners."
                            : "Clear the search or choose another status."}
                        </p>
                        {batches.length > 0 && (
                          <button
                            type="button"
                            className="po-btn"
                            onClick={() => {
                              setSearch("");
                              setStatusFilter("All");
                            }}
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <footer className="po-foot">
          <span>
            Showing {filteredBatches.length} of {pagination.total} batches
          </span>

          <div className="po-pager">
            <button
              type="button"
              className="po-btn is-small"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {Math.max(1, pagination.pages)}
            </span>
            <button
              type="button"
              className="po-btn is-small"
              onClick={() =>
                setPage((current) => Math.min(Math.max(1, pagination.pages), current + 1))
              }
              disabled={loading || pagination.pages === 0 || page >= pagination.pages}
            >
              Next
            </button>
          </div>
        </footer>
      </section>
      <section className="po-card" aria-label="Admin wallet history">
        <header className="po-card-head">
          <div>
            <h2>Admin wallet history</h2>
            <p>
              Every commission you earned and every amount paid to partners, added when a payout is confirmed.
            </p>
          </div>

          <div className="po-tabs" role="tablist" aria-label="Filter wallet history">
            {(
              [
                ["commission", "Commission"],
                ["partner_payout", "Partner payouts"],
                ["all", "All"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={txFilter === value}
                className={txFilter === value ? "is-active" : undefined}
                onClick={() => setTxFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {txError && (
          <div className="po-alert is-error" role="alert">
            <span>{txError}</span>
            <button type="button" className="po-link" onClick={() => void loadWalletTransactions()}>
              Retry
            </button>
          </div>
        )}

        {txLoading ? (
          <div className="po-state" aria-live="polite">
            <span className="po-spinner" />
            <p>Loading history…</p>
          </div>
        ) : (
          <div className="po-scroll">
            <table className="po-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Partner</th>
                  <th>Batch</th>
                  <th className="is-num">Amount</th>
                </tr>
              </thead>

              <tbody>
                {txItems.map((tx) => {
                  const period = formatPeriod(tx.periodStart, tx.periodEnd);

                  return (
                    <tr
                      key={tx.id}
                      className="is-clickable"
                      onClick={() => tx.batchId && openDetails({ id: tx.batchId } as PayoutBatch)}
                    >
                      <td>{formatDate(tx.createdAt)}</td>
                      <td>
                        <span
                          className={`po-chip ${
                            tx.type === "commission" ? "is-paid" : "is-processing"
                          }`}
                        >
                          <i aria-hidden="true" />
                          {tx.type === "commission" ? "Commission" : "Partner payout"}
                        </span>
                      </td>
                      <td>{tx.partnerName}</td>
                      <td>
                        <div className="po-week">
                          <b>{period.range}</b>
                          <small>Batch {shortId(tx.batchId, 12)}</small>
                        </div>
                      </td>
                      <td className="is-num is-strong">
                        {tx.amount > 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(tx.amount))}
                      </td>
                    </tr>
                  );
                })}

                {!txError && txItems.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="po-state is-inline">
                        <h2>No transactions yet</h2>
                        <p>Commission shows up here after you confirm a payout.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <footer className="po-foot">
          <span>
            {txPagination.total} transaction{txPagination.total === 1 ? "" : "s"}
            {txFilter === "commission" ? ` · Total commission ${formatCurrency(txTotal)}` : ""}
          </span>

          <div className="po-pager">
            <button
              type="button"
              className="po-btn is-small"
              onClick={() => setTxPage((current) => Math.max(1, current - 1))}
              disabled={txPage <= 1 || txLoading}
            >
              Previous
            </button>
            <span>
              Page {txPagination.page} of {Math.max(1, txPagination.pages)}
            </span>
            <button
              type="button"
              className="po-btn is-small"
              onClick={() => setTxPage((current) => current + 1)}
              disabled={txLoading || txPagination.pages === 0 || txPage >= txPagination.pages}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

    </main>
  );
};

export default AdminPayoutsPage;
