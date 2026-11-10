import React, { lazy, Suspense, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./index.css";
import PayoutBatches from "./PayoutBatches";
import PayoutBatchDetails from "./PayoutBatchDetails";
import { fetchPendingWithdrawalCount } from "@/services/payoutBatchApi";

const AdminWithdrawalsPage = lazy(() => import("@/pages/admin/Withdrawals"));

/**
 * Admin Payouts: everything about paying partners lives here.
 * /admin/payouts      : overview cards, payout batches, then withdrawal requests.
 * /admin/payouts/:id  : one batch with every partner's payout and the services behind it.
 */
export const AdminPayoutsPage: React.FC = () => {
  const { id: batchId } = useParams<{ id: string }>();
  const [pending, setPending] = useState(0);

  // New withdrawal requests show up without a refresh: check now, every minute, and when the tab is focused again.
  useEffect(() => {
    if (batchId) return undefined;
    let alive = true;
    const check = () => {
      fetchPendingWithdrawalCount()
        .then((n) => alive && setPending(n))
        .catch(() => undefined);
    };
    check();
    const timer = window.setInterval(check, 60_000);
    window.addEventListener("focus", check);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [batchId]);

  return (
    <main className="admin-page-container payout-page">
      <header className="po-head">
        <div>
          <h1>Payouts</h1>
          <p className="po-sub">
            Pay partners for settled earnings. Pick a period, create a batch, then process the payout.
          </p>
        </div>
      </header>

      {batchId ? (
        <PayoutBatchDetails key={batchId} />
      ) : (
        <>
          <PayoutBatches pendingWithdrawals={pending} />

          <section className="pb-withdrawals" id="withdrawal-requests" aria-labelledby="pb-wd-title">
            <h2 id="pb-wd-title" className="pb-section-title">Withdrawal requests</h2>
            {pending > 0 && (
              <p className="pb-wd-msg pb-wd-msg--on" role="status">
                {`${pending} withdrawal request${pending === 1 ? "" : "s"} waiting for approval.`}
              </p>
            )}
            <Suspense fallback={<p className="pb-state" role="status">Loading withdrawal requests…</p>}>
              <AdminWithdrawalsPage embedded />
            </Suspense>
          </section>
        </>
      )}
    </main>
  );
};

export default AdminPayoutsPage;