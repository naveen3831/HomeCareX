import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import DataTable, {
  Column,
} from "../../../components/tables/DataTable";
import './index.css';
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
  actor: string;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip: string;
  result: "Success" | "Failed";
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


const parseJson = (raw: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const showValue = (v: unknown) =>
  v === undefined ? "—" : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);

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
        <span className={log.result === "Success" ? "success-badge" : "failed-badge"}>{log.result}</span>
      </section>

      <dl className="audit-detail__facts">
        {facts.map((f) => (
          <div key={f.label} className="audit-detail__fact">
            <dt>{f.label}</dt>
            <dd>{f.value || "—"}</dd>
          </div>
        ))}
      </dl>

      <section className="audit-detail__card">
        <h3>What changed</h3>
        {changes.length === 0 ? (
          <p className="audit-detail__empty">No field-level changes were recorded.</p>
        ) : (
          <ul className="audit-detail__changes">
            {changes.map((c) => (
              <li key={c.field}>
                <code>{c.field}</code>
                <div className="audit-detail__change-vals">
                  <span className="audit-detail__before">{showValue(c.before)}</span>
                  <span aria-hidden="true" className="audit-detail__arrow">→</span>
                  <span className="audit-detail__after">{showValue(c.after)}</span>
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
  // Search box sits right under the page title
  const [search, setSearch] = useState("");
  // Mouse drag-scroll for the table (swipe already works on phones)
  const scrollRootRef = useDragScroll<HTMLDivElement>(".datatable-wrapper");
  const [selectedLog, setSelectedLog] =
    useState<AuditLog | null>(null);

  const [auditLogsData, setAuditLogsData] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setLoading(true);
        setError("");

        // Shared axios client: sends the admin Bearer token + cookies and uses the
        // same /api/v1 base URL (dev proxy) as every other admin page.
        const { data: result } = await http.get<AuditLogsResponse>(
          "/admin/audit-logs",
          { params: { limit: 100 } }
        );

        if (!result.success) {
          throw new Error("Failed to load audit logs");
        }

        const logs: AuditLog[] =
          result.data.items.map((log) => ({
            id: log.id || log._id || "",
            timestamp: new Date(
              log.timestamp || log.createdAt || ""
            ).toLocaleString(),
            actor: log.actor,
            actorName: log.actorName || log.actor,
            action: log.action,
            entity: log.entity,
            entityId: log.entityId,
            ip: log.ip,
            result: log.result,
            before:
              log.before === undefined ||
              log.before === null
                ? "{}"
                : typeof log.before === "string"
                ? log.before
                : JSON.stringify(
                    log.before,
                    null,
                    2
                  ),
            after:
              log.after === undefined ||
              log.after === null
                ? "{}"
                : typeof log.after === "string"
                ? log.after
                : JSON.stringify(
                    log.after,
                    null,
                    2
                  ),
          }));

        setAuditLogsData(logs);
      } catch (err) {
        console.error(
          "Failed to fetch audit logs:",
          err
        );

        const status = (err as { response?: { status?: number } })
          ?.response?.status;

        setError(
          status === 401
            ? "Your session has expired. Please sign in again."
            : status === 403
            ? "You do not have permission to view audit logs."
            : "Unable to load audit logs. Please check that the backend is running."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, []);

  const filteredLogs = auditLogsData.filter((log) => {
    const searchValue = search.toLowerCase().trim();

    if (!searchValue) {
      return true;
    }

    return (
      log.actorName
        .toLowerCase()
        .includes(searchValue) ||
      log.actor
        .toLowerCase()
        .includes(searchValue) ||
      log.action
        .toLowerCase()
        .includes(searchValue) ||
      log.entity
        .toLowerCase()
        .includes(searchValue) ||
      log.entityId
        .toLowerCase()
        .includes(searchValue) ||
      log.ip
        .toLowerCase()
        .includes(searchValue) ||
      log.result
        .toLowerCase()
        .includes(searchValue)
    );
  });

  const auditColumns: Column<AuditLog>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      sortValue: (row) => row.timestamp,
    },
    {
      key: "actor",
      header: "Actor",
      sortValue: (row) => row.actorName,
      cell: (row) => row.actorName,
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
  ];

  return (
    <div className="admin-auditlogs-container" ref={scrollRootRef}>
      <div className="auditlogs-header">
        <h1 className="auditlogs-title">
          Audit Logs
        </h1>
      </div>

      <div className="auditlogs-search">
        <Search size={18} aria-hidden="true" className="auditlogs-search__icon" />
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search actor, action, entity, ID or IP…"
          aria-label="Search audit logs"
        />
      </div>

      {loading && (
        <div className="auditlogs-count">
          Loading audit logs...
        </div>
      )}

      {!loading && error && (
        <div className="auditlogs-count">
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
              emptyMessage={
                search
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

      <FullScreenPanel
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title="Audit Log Details"
        subtitle={selectedLog ? `${selectedLog.actorName} · ${selectedLog.timestamp}` : undefined}
      >
        {selectedLog && <AuditDetails log={selectedLog} />}
      </FullScreenPanel>
    </div>
  );
};

export default AdminAuditLogsPage;