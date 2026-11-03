import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import DataTable, { Column } from "../../../components/tables/DataTable";
import "./index.css";
import http from "@/lib/http";
import { useDragScroll } from "@/hooks/useDragScroll";
import FullScreenPanel from "@/components/admin/FullScreenPanel";
import { diffRecords } from "@/components/admin/AuditDiffDrawer";

interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  actorName: string;
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
  actor?: string | null;
  actorName?: string | null;
  action?: string | null;
  entity?: string | null;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  result?: string | null;
  timestamp?: string;
  createdAt?: string;
}

interface AuditLogsResponse {
  success: boolean;
  data?: {
    items?: AuditLogApi[];
    total?: number;
    page?: number;
    limit?: number;
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

const formatTimestamp = (timestamp?: string, createdAt?: string): string => {
  const raw = timestamp || createdAt;
  if (!raw) return "—";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const normalizeResult = (result?: string | null): "Success" | "Failed" =>
  result?.toLowerCase() === "success" ? "Success" : "Failed";

const parseJson = (raw: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(raw);

    return value &&
      typeof value === "object" &&
      !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const showValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "—";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const AuditDetails: React.FC<{ log: AuditLog }> = ({ log }) => {
  const changes = diffRecords(parseJson(log.before), parseJson(log.after));
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Timestamp", value: log.timestamp },
    { label: "Actor", value: log.actorName },
    { label: "Actor ID", value: log.actor },
    { label: "Action", value: log.action },
    { label: "Entity", value: log.entity },
    { label: "Entity ID", value: log.entityId },
    { label: "IP address", value: log.ip },
  ];

  return (
    <div className="audit-detail">
      <section className="audit-detail__hero">
        <div className="audit-detail__hero-main">
          <span className="audit-detail__eyebrow">Action</span>
          <strong className="audit-detail__action">{log.action}</strong>
          <span className="audit-detail__sub">
            on {log.entity}
            {log.entityId ? ` · ${log.entityId}` : ""}
          </span>
        </div>
        <span className={log.result === "Success" ? "success-badge" : "failed-badge"}>
          {log.result}
        </span>
      </section>

      <dl className="audit-detail__facts">
        {facts.map((fact) => (
          <div key={fact.label} className="audit-detail__fact">
            <dt>{fact.label}</dt>
            <dd>{fact.value || "—"}</dd>
          </div>
        ))}
      </dl>

      <section className="audit-detail__card">
        <h3>What changed</h3>
        {changes.length === 0 ? (
          <p className="audit-detail__empty">No field-level changes were recorded.</p>
        ) : (
          <ul className="audit-detail__changes">
            {changes.map((change) => (
              <li key={change.field}>
                <code>{change.field}</code>
                <div className="audit-detail__change-vals">
                  <span className="audit-detail__before">{showValue(change.before)}</span>
                  <span aria-hidden="true" className="audit-detail__arrow">
                    →
                  </span>
                  <span className="audit-detail__after">{showValue(change.after)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="audit-detail__json">
        <section className="audit-detail__card">
          <h3>Before</h3>
          <pre className="json-box">{log.before}</pre>
        </section>
        <section className="audit-detail__card">
          <h3>After</h3>
          <pre className="json-box">{log.after}</pre>
        </section>
      </div>
    </div>
  );
};

const AdminAuditLogsPage: React.FC = () => {
  // Optional route param: /admin/audit-logs/:auditId opens the full-page details view
  const { id: auditId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Mouse drag-scroll for the table (swipe already works on phones)
  const scrollRootRef = useDragScroll<HTMLDivElement>(".datatable-wrapper");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [auditLogsData, setAuditLogsData] = useState<AuditLog[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchAuditLogs = async () => {
      try {
        setLoading(true);
        setError("");

        // Shared axios client: sends the admin Bearer token + cookies, same base URL as every admin page.
        const { data: result } = await http.get<AuditLogsResponse>("/admin/audit-logs", {
          params: { limit: 100 },
        });

        if (!result?.success || !result.data || !Array.isArray(result.data.items)) {
          throw new Error("Invalid audit logs response.");
        }

        const logs: AuditLog[] = result.data.items.map((log) => ({
          id: String(log.id || log._id || ""),
          timestamp: formatTimestamp(log.timestamp, log.createdAt),
          actor: log.actor || "—",
          actorName: log.actorName || log.actor || "—",
          action: log.action || "—",
          entity: log.entity || "—",
          entityId: log.entityId || "—",
          ip: log.ip || "—",
          result: normalizeResult(log.result),
          before: formatJson(log.before),
          after: formatJson(log.after),
        }));

        if (!cancelled) setAuditLogsData(logs);
      } catch (err) {
        console.error("Failed to fetch audit logs:", err);
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (!cancelled) {
          setError(
            status === 401
              ? "Your session has expired. Please sign in again."
              : status === 403
                ? "You do not have permission to view audit logs."
                : "Unable to load audit logs. Please check that the backend is running.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchAuditLogs();

    return () => {
      cancelled = true;
    };
  }, []);

  const query = searchValue.toLowerCase().trim();
  const totalLogs = auditLogsData.length;

  const filteredLogs = useMemo(
    () =>
      auditLogsData.filter((log) =>
        !query
          ? true
          : [
              log.id,
              log.timestamp,
              log.actor,
              log.actorName,
              log.action,
              log.entity,
              log.entityId,
              log.ip,
              log.result,
            ].some((value) => value.toLowerCase().includes(query)),
      ),
    [auditLogsData, query],
  );

  // Full-page details view (only when the URL has an :auditId)
  const selectedAuditLog = auditLogsData.find((log) => log.id === auditId);
  if (auditId) {
    if (loading) {
      return (
        <main className="admin-auditlogs-container audit-details-fullpage">
          <p className="audit-details-status">Loading audit details...</p>
        </main>
      );
    }

    if (error || !selectedAuditLog) {
      return (
        <main className="admin-auditlogs-container audit-details-fullpage">
          <button type="button" className="view-btn audit-back-btn" onClick={() => navigate("/admin/audit-logs")}>
            ← Back to Audit Logs
          </button>
          <div className="audit-details-error" role="alert">
            {error || "Audit log not found in the loaded records. Return to the list and try again."}
          </div>
        </main>
      );
    }

    return (
      <main className="admin-auditlogs-container audit-details-fullpage">
        <header className="audit-details-page-header">
          <div>
            <button type="button" className="view-btn audit-back-btn" onClick={() => navigate("/admin/audit-logs")}>
              ← Back to Audit Logs
            </button>
            <h1 className="auditlogs-title audit-details-heading">Audit Log Details</h1>
            <p className="audit-details-subtitle">
              Review the recorded action, its outcome, and the changes associated with this audit entry.
            </p>
          </div>
          <span className={selectedAuditLog.result === "Success" ? "success-badge" : "failed-badge"}>
            {selectedAuditLog.result}
          </span>
        </header>

        <section className="audit-details-card">
          <h2>Audit Information</h2>
          <div className="audit-details-grid">
            {[
              ["Audit ID", selectedAuditLog.id],
              ["Timestamp", selectedAuditLog.timestamp],
              ["Actor", selectedAuditLog.actor],
              ["Action", selectedAuditLog.action],
              ["Entity", selectedAuditLog.entity],
              ["Entity ID", selectedAuditLog.entityId],
              ["IP Address", selectedAuditLog.ip],
              ["Result", selectedAuditLog.result],
            ].map(([label, value]) => (
              <div key={label} className="audit-details-field">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <div className="audit-details-json-grid">
          <section className="audit-details-card audit-details-json-card">
            <h2>Before Changes</h2>
            <p className="audit-details-json-description">Recorded data before the action was performed.</p>
            <pre className="audit-details-json">{selectedAuditLog.before}</pre>
          </section>
          <section className="audit-details-card audit-details-json-card">
            <h2>After Changes</h2>
            <p className="audit-details-json-description">Recorded data after the action was performed.</p>
            <pre className="audit-details-json">{selectedAuditLog.after}</pre>
          </section>
        </div>
      </main>
    );
  }

  const auditColumns: Column<AuditLog>[] = [
    { key: "timestamp", header: "Timestamp", sortValue: (row) => row.timestamp },
    { key: "actor", header: "Actor", sortValue: (row) => row.actorName, cell: (row) => row.actorName },
    { key: "action", header: "Action", sortValue: (row) => row.action },
    { key: "entity", header: "Entity", sortValue: (row) => row.entity },
    { key: "entityId", header: "Entity ID", sortValue: (row) => row.entityId },
    { key: "ip", header: "IP Address", sortValue: (row) => row.ip },
    {
      key: "result",
      header: "Result",
      sortValue: (row) => row.result,
      cell: (row) => (
        <span className={row.result === "Success" ? "success-badge" : "failed-badge"}>{row.result}</span>
      ),
    },
    {
      key: "details",
      header: "Details",
      cell: (row) => (
        <button
          type="button"
          className="view-btn"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(row);
          }}
        >
          View Audit
        </button>
      ),
    },
  ];

  return (
    <main className="admin-auditlogs-container" ref={scrollRootRef}>
      <div className="auditlogs-header">
        <div className="auditlogs-heading-content">
          <h1 className="auditlogs-title">Audit Logs</h1>
          <p className="auditlogs-description">
            Monitor system activity, track administrative actions, and review changes for accountability and security.
          </p>
        </div>
      </div>

      <div className="auditlogs-search">
        <Search size={18} aria-hidden="true" className="auditlogs-search__icon" />
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search actor, action, entity, ID or IP…"
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

      {loading && <div className="auditlogs-count">Loading audit logs...</div>}

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
              rowKey={(row) => String(row.id)}
              label="Audit logs"
              onRowClick={(row) => setSelectedLog(row)}
              defaultPageSize={10}
              pageSizeOptions={[5, 10, 20, 50]}
              emptyTitle="No audit logs found"
              emptyMessage={query ? "No audit logs match your search." : "There are no audit logs to display."}
            />
          </div>
          <div className="auditlogs-count">
            {query ? `Showing ${filteredLogs.length} of ${totalLogs} logs` : `Total Logs: ${totalLogs}`}
          </div>
        </>
      )}

      <FullScreenPanel
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title="Audit Log Details"
        subtitle={selectedLog ? `${selectedLog.actorName} · ${selectedLog.timestamp}` : undefined}
      >
        {selectedLog && <AuditDetails log={selectedLog} />}
      </FullScreenPanel>
    </main>
  );
};

export default AdminAuditLogsPage;
