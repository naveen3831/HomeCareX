import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DataTable, {
  Column,
} from "../../../components/tables/DataTable";
import "./index.css";
import { http } from "@/lib/http";

interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  ip: string;
  result: "Success" | "Failed";
  before: string;
  after: string;
}

interface AuditLogApi {
  _id?: string;
  id?: string;
  actor?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  result?: string;
  timestamp?: string;
  createdAt?: string;
}

interface AuditLogsResponse {
  success: boolean;
  data: {
    items: AuditLogApi[];
    total: number;
    page: number;
    limit: number;
  };
}

const formatJson = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "{}";
  }

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  try {
    return JSON.stringify(value, null, 2) ?? "{}";
  } catch {
    return String(value);
  }
};

const formatTimestamp = (
  timestamp?: string,
  createdAt?: string
): string => {
  const rawTimestamp = timestamp || createdAt;

  if (!rawTimestamp) {
    return "—";
  }

  const parsedTimestamp = new Date(rawTimestamp);

  if (Number.isNaN(parsedTimestamp.getTime())) {
    return "—";
  }

  return parsedTimestamp.toLocaleString();
};

const normalizeResult = (
  result?: string
): "Success" | "Failed" => {
  return result?.toLowerCase() === "success"
    ? "Success"
    : "Failed";
};

const AdminAuditLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: auditId } = useParams<{ id: string }>();

  const [auditLogsData, setAuditLogsData] =
    useState<AuditLog[]>([]);

  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchAuditLogs = async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await http.get<AuditLogsResponse>(
            "/admin/audit-logs"
          );

        const result = response.data;

        if (
          !result?.success ||
          !result.data ||
          !Array.isArray(result.data.items)
        ) {
          throw new Error("Invalid audit logs response.");
        }

        const logs: AuditLog[] =
          result.data.items.map((log) => ({
            id: String(log.id || log._id || ""),
            timestamp: formatTimestamp(
              log.timestamp,
              log.createdAt
            ),
            actor: log.actor || "—",
            action: log.action || "—",
            entity: log.entity || "—",
            entityId: log.entityId || "—",
            ip: log.ip || "—",
            result: normalizeResult(log.result),
            before: formatJson(log.before),
            after: formatJson(log.after),
          }));

        if (!cancelled) {
          setAuditLogsData(logs);
        }
      } catch (err) {
        console.error(
          "Failed to fetch audit logs:",
          err
        );

        if (!cancelled) {
          setError(
            "Unable to load audit logs. Please check your session and try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchAuditLogs();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter the audit records using the page-specific search bar.
  const query = searchValue.toLowerCase().trim();

  const filteredLogs = auditLogsData.filter((log) => {
    if (!query) {
      return true;
    }

    return [
      log.id,
      log.timestamp,
      log.actor,
      log.action,
      log.entity,
      log.entityId,
      log.ip,
      log.result,
    ].some((value) =>
      value.toLowerCase().includes(query)
    );
  });

  // Full-page details view when the URL contains an audit ID.
  if (auditId) {
    const selectedLog = auditLogsData.find(
      (log) => log.id === auditId
    );

    if (loading) {
      return (
        <main className="admin-auditlogs-container audit-details-fullpage">
          <p className="audit-details-status">
            Loading audit details...
          </p>
        </main>
      );
    }

    if (error || !selectedLog) {
      return (
        <main className="admin-auditlogs-container audit-details-fullpage">
          <button
            type="button"
            className="view-btn audit-back-btn"
            onClick={() =>
              navigate("/admin/audit-logs")
            }
          >
            ← Back to Audit Logs
          </button>

          <div
            className="audit-details-error"
            role="alert"
          >
            {error ||
              "Audit log not found in the loaded records. Return to the list and try again."}
          </div>
        </main>
      );
    }

    return (
      <main className="admin-auditlogs-container audit-details-fullpage">
        <header className="audit-details-page-header">
          <div>
            <button
              type="button"
              className="view-btn audit-back-btn"
              onClick={() =>
                navigate("/admin/audit-logs")
              }
            >
              ← Back to Audit Logs
            </button>

            <h1 className="auditlogs-title audit-details-heading">
              Audit Log Details
            </h1>

            <p className="audit-details-subtitle">
              Review the recorded action, its outcome, and
              the changes associated with this audit entry.
            </p>
          </div>

          <span
            className={
              selectedLog.result === "Success"
                ? "success-badge"
                : "failed-badge"
            }
          >
            {selectedLog.result}
          </span>
        </header>

        <section className="audit-details-card">
          <h2>Audit Information</h2>

          <div className="audit-details-grid">
            <div className="audit-details-field">
              <span>Audit ID</span>
              <strong>{selectedLog.id}</strong>
            </div>

            <div className="audit-details-field">
              <span>Timestamp</span>
              <strong>{selectedLog.timestamp}</strong>
            </div>

            <div className="audit-details-field">
              <span>Actor</span>
              <strong>{selectedLog.actor}</strong>
            </div>

            <div className="audit-details-field">
              <span>Action</span>
              <strong>{selectedLog.action}</strong>
            </div>

            <div className="audit-details-field">
              <span>Entity</span>
              <strong>{selectedLog.entity}</strong>
            </div>

            <div className="audit-details-field">
              <span>Entity ID</span>
              <strong>{selectedLog.entityId}</strong>
            </div>

            <div className="audit-details-field">
              <span>IP Address</span>
              <strong>{selectedLog.ip}</strong>
            </div>

            <div className="audit-details-field">
              <span>Result</span>
              <strong>{selectedLog.result}</strong>
            </div>
          </div>
        </section>

        <div className="audit-details-json-grid">
          <section className="audit-details-card audit-details-json-card">
            <h2>Before Changes</h2>

            <p className="audit-details-json-description">
              Recorded data before the action was performed.
            </p>

            <pre className="audit-details-json">
              {selectedLog.before}
            </pre>
          </section>

          <section className="audit-details-card audit-details-json-card">
            <h2>After Changes</h2>

            <p className="audit-details-json-description">
              Recorded data after the action was performed.
            </p>

            <pre className="audit-details-json">
              {selectedLog.after}
            </pre>
          </section>
        </div>
      </main>
    );
  }

  const auditColumns: Column<AuditLog>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      sortValue: (row) => row.timestamp,
    },
    {
      key: "actor",
      header: "Actor",
      sortValue: (row) => row.actor,
    },
    {
      key: "action",
      header: "Action",
      sortValue: (row) => row.action,
    },
    {
      key: "entity",
      header: "Entity",
      sortValue: (row) => row.entity,
    },
    {
      key: "entityId",
      header: "Entity ID",
      sortValue: (row) => row.entityId,
    },
    {
      key: "ip",
      header: "IP Address",
      sortValue: (row) => row.ip,
    },
    {
      key: "result",
      header: "Result",
      sortValue: (row) => row.result,
      cell: (row) => (
        <span
          className={
            row.result === "Success"
              ? "success-badge"
              : "failed-badge"
          }
        >
          {row.result}
        </span>
      ),
    },
    {
      key: "details",
      header: "Details",
      cell: (row) => (
        <button
          type="button"
          className="view-btn"
          onClick={() =>
            navigate(
              `/admin/audit-logs/${encodeURIComponent(row.id)}`
            )
          }
        >
          View Audit
        </button>
      ),
    },
  ];

  return (
    <main className="admin-auditlogs-container">
      {/* Page heading and description */}
      <div className="auditlogs-header">
        <div className="auditlogs-heading-content">
          <h1 className="auditlogs-title">
            Audit Logs
          </h1>

          <p className="auditlogs-description">
            Monitor system activity, track administrative
            actions, and review changes for accountability
            and security.
          </p>
        </div>
      </div>

      {/* Search bar directly below the description */}
      <div className="auditlogs-search">
        <span
          className="auditlogs-search-icon"
          aria-hidden="true"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
        </span>

        <input
          type="search"
          value={searchValue}
          onChange={(event) =>
            setSearchValue(event.target.value)
          }
          placeholder="Search audit logs"
          aria-label="Search audit logs"
        />

        {searchValue && (
          <button
            type="button"
            className="auditlogs-search-clear"
            onClick={() => setSearchValue("")}
            aria-label="Clear search"
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {loading && (
        <div className="auditlogs-count">
          Loading audit logs...
        </div>
      )}

      {!loading && error && (
        <div className="auditlogs-count" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="auditlogs-table-container">
            <DataTable
              columns={auditColumns}
              data={filteredLogs}
              rowKey={(row) => row.id}
              label="Audit logs"
              defaultPageSize={10}
              pageSizeOptions={[5, 10, 20, 50]}
              emptyTitle="No audit logs found"
              emptyMessage={
                query
                  ? "No audit logs match your search."
                  : "There are no audit logs to display."
              }
            />
          </div>

          <div className="auditlogs-count">
            Total Logs: {filteredLogs.length}
          </div>
        </>
      )}
    </main>
  );
};

export default AdminAuditLogsPage;
