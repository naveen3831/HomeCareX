import React from "react";
import { Navigate, useParams } from "react-router-dom";
import "./index.css";
import PayoutLedger from "./PayoutLedger";

/**
 * Admin Payouts: the daily / weekly credit and debit report.
 * Partner shares and admin commission are settled automatically when a service is completed,
 * so there are no payout batches to create or confirm here any more.
 */
export const AdminPayoutsPage: React.FC = () => {
  // Old links to /admin/payouts/:batchId (batch details) now land on the report.
  const { id: routeId } = useParams<{ id: string }>();
  if (routeId) return <Navigate to="/admin/payouts" replace />;

  return (
    <main className="admin-page-container payout-page">
      <header className="po-head">
        <div>
          <h1>Payouts</h1>
          <p className="po-sub">
            See how every completed service moved money: what the admin received and what was credited to or debited
            from partner wallets, day by day or week by week.
          </p>
        </div>
      </header>

      <PayoutLedger />
    </main>
  );
};

export default AdminPayoutsPage;