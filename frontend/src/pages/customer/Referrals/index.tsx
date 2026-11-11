import { useState } from "react";
import { Gift } from "lucide-react";
import { useReferral } from "@/hooks/useReferral";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { problem, when } from "@/features/support/types";
import ReferralCard, { money } from "@/components/support/ReferralCard";
import "../Support/Support.css";

export default function Referrals() {
  const [page, setPage] = useState(1);
  const query = useReferral(page);
  const online = useOnlineStatus();
  return (
    <div className="hcx-support">
      <header className="hcx-support-hero">
        <span className="hcx-support-icon">
          <Gift size={26} aria-hidden="true" />
        </span>
        <div>
          <p className="hcx-support-eyebrow">SHARE A LITTLE HOME CARE</p>
          <h1>Friends. Home care. Rewards.</h1>
          <p>Invite friends and follow their first booking milestones.</p>
        </div>
      </header>
      {!online && (
        <p className="hcx-support-notice" role="status">
          You’re offline. Reconnect to update your referral progress.
        </p>
      )}
      {query.isError && (
        <p role="alert" className="hcx-support-error">
          {problem(query.error)}{" "}
          <button
            type="button"
            disabled={!online}
            onClick={() => void query.refetch()}
          >
            Try again
          </button>
        </p>
      )}
      {!query.data && !query.isError && (
        <p className="hcx-support-state" role="status">
          {online
            ? "Loading your referrals…"
            : "Reconnect to load your referral code."}
        </p>
      )}
      {query.data && !query.data.offers?.length && (
        <div className="hcx-support-state" role="status">
          <h3>No referral offers right now</h3>
          <p>Check back soon. New referral offers will appear here.</p>
        </div>
      )}
      {query.data && (query.data.offers?.length || query.data.entries.length) ? (
        <>
          {!!query.data.offers?.length && (
          <div
            className="hcx-support-referral-stats"
            aria-label="Referral statistics"
          >
            <div>
              <strong>{query.data.stats.invited}</strong>
              <span>Friends invited</span>
            </div>
            <div>
              <strong>{query.data.stats.completed}</strong>
              <span>First bookings completed</span>
            </div>
            <div>
              <strong>{money(query.data.stats.rewardsPaise)}</strong>
              <span>Wallet rewards credited</span>
            </div>
          </div>
          )}
          {!!query.data.offers?.length && (
          <div className="hcx-support-panel">
            <ReferralCard data={query.data} />
          </div>
          )}
          <section className="hcx-support-panel hcx-support-referral-history">
            <h2>Referral activity</h2>
            {query.data.entries.length ? (
              <ul className="hcx-support-ticket-list">
                {query.data.entries.map((entry, i) => (
                  <li key={entry.id} className="hcx-support-ticket">
                    <div>
                      <h3>Invitation {(page - 1) * 10 + i + 1}</h3>
                      <time dateTime={entry.createdAt}>
                        {when(entry.createdAt)}
                      </time>
                    </div>
                    <div className="hcx-support-ticket-meta">
                      <span className="hcx-support-badge">
                        {entry.status === "rewarded"
                          ? "Reward credited"
                          : entry.status === "completed"
                            ? "Reward pending"
                            : "Awaiting first booking"}
                      </span>
                      <span>
                        {entry.status === "rewarded"
                          ? money(entry.rewardPaise)
                          : "Not credited yet"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="hcx-support-state">
                <h3>Your first invitation starts here</h3>
                <p>
                  Share your code with a friend. Their sign-up will appear here.
                </p>
              </div>
            )}
            {query.data.meta.pages > 1 && (
              <nav
                className="hcx-support-pagination"
                aria-label="Referral pages"
              >
                <button
                  type="button"
                  disabled={!online || page === 1 || query.isFetching}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {query.data.meta.pages}
                </span>
                <button
                  type="button"
                  disabled={
                    !online || page >= query.data.meta.pages || query.isFetching
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}