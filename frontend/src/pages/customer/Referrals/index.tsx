import { useState } from "react";
import { Link } from "react-router-dom";
import { Gift, ArrowRight, Wallet, Check } from "lucide-react";
import clsx from "clsx";
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
      {query.data && (
        <>
          {query.data.referredBy && (
            <section
              className="hcx-referral-welcome-card"
              aria-label="Your Referral Welcome Bonus"
            >
              {/* Decorative pastel celebratory confetti matching proof */}
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden select-none"
                aria-hidden="true"
              >
                {/* Top left starburst */}
                <svg
                  className="absolute top-2 left-6 w-3.5 h-3.5 text-purple-400 opacity-60"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
                </svg>
                {/* Top dots & stars */}
                <svg
                  className="absolute top-3 left-[30%] w-2.5 h-2.5 text-pink-400 opacity-50"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                >
                  <circle cx="5" cy="5" r="4" />
                </svg>
                <svg
                  className="absolute top-4 right-[25%] w-3.5 h-3.5 text-amber-400 opacity-60 rotate-12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
                </svg>
                {/* Mid right confetti streamer */}
                <svg
                  className="absolute top-[35%] right-3 w-4 h-4 text-emerald-400 opacity-60 -rotate-45"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <rect x="2" y="2" width="12" height="3" rx="1.5" />
                </svg>
                {/* Mid left circle */}
                <svg
                  className="absolute top-[48%] left-3 w-2.5 h-2.5 text-indigo-400 opacity-50"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                >
                  <circle cx="5" cy="5" r="4" />
                </svg>
                {/* Bottom right star */}
                <svg
                  className="absolute bottom-16 right-5 w-3 h-3 text-teal-400 opacity-50"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z" />
                </svg>
                {/* Bottom left ribbon */}
                <svg
                  className="absolute bottom-6 left-7 w-3.5 h-3.5 text-rose-400 opacity-40 rotate-45"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <rect x="2" y="2" width="12" height="3" rx="1.5" />
                </svg>
              </div>

              {/* Top Row: Pill Badges */}
              <div className="relative z-10 flex items-center justify-between gap-2 mb-3.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100/90 border border-indigo-200/70 px-3 py-1 text-[10px] sm:text-xs font-bold text-indigo-800 tracking-wider">
                  <Gift size={13} className="text-indigo-600 shrink-0" aria-hidden="true" />
                  <span>REFERRAL WELCOME REWARD</span>
                </div>

                <span
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] sm:text-xs font-bold tracking-wider uppercase text-white shadow-xs",
                    query.data.referredBy.status === "rewarded"
                      ? "bg-[#10b981]"
                      : query.data.referredBy.status === "completed"
                        ? "bg-blue-600"
                        : "bg-amber-500"
                  )}
                >
                  {query.data.referredBy.status === "rewarded" ? (
                    <>
                      <Check size={12} className="text-white stroke-[3] shrink-0" aria-hidden="true" />
                      <span>CREDITED</span>
                    </>
                  ) : query.data.referredBy.status === "completed" ? (
                    <span>PROCESSING</span>
                  ) : (
                    <span>PENDING</span>
                  )}
                </span>
              </div>

              {/* Main Heading */}
              <div className="relative z-10 mb-2">
                <h2 className="text-2xl sm:text-[32px] font-black text-slate-900 leading-[1.15] tracking-tight">
                  {query.data.referredBy.status === "rewarded" ? (
                    <>
                      {money(query.data.referredBy.rewardPaise || 5000)} Bonus Credited!{" "}
                      <span role="img" aria-label="celebration" className="inline-block text-2xl sm:text-3xl align-middle">
                        🎉
                      </span>
                    </>
                  ) : query.data.referredBy.status === "completed" ? (
                    <>
                      {money(query.data.referredBy.rewardPaise || 5000)} Bonus Processing!{" "}
                      <span role="img" aria-label="processing" className="inline-block text-2xl sm:text-3xl align-middle">
                        ⚙️
                      </span>
                    </>
                  ) : (
                    <>
                      Earn {money(query.data.referredBy.rewardPaise || 5000)} on your first booking{" "}
                      <span role="img" aria-label="gift" className="inline-block text-2xl sm:text-3xl align-middle">
                        🎁
                      </span>
                    </>
                  )}
                </h2>
              </div>

              {/* Description Paragraph */}
              <p className="relative z-10 text-[13px] sm:text-sm text-slate-600 leading-relaxed font-normal mb-5">
                {query.data.referredBy.status === "rewarded" ? (
                  <>
                    Your referral bonus has been successfully added to your wallet for signing up through{" "}
                    <strong className="font-semibold text-slate-800">{query.data.referredBy.referrerName}</strong>&apos;s invite (code{" "}
                    <span className="font-mono font-bold text-indigo-700">{query.data.referredBy.code}</span>).
                  </>
                ) : query.data.referredBy.status === "completed" ? (
                  <>
                    Your first booking is recorded! Your {money(query.data.referredBy.rewardPaise || 5000)} welcome bonus from{" "}
                    <strong className="font-semibold text-slate-800">{query.data.referredBy.referrerName}</strong> is being processed to your wallet balance.
                  </>
                ) : (
                  <>
                    You joined HomeCareX using <strong className="font-semibold text-slate-800">{query.data.referredBy.referrerName}</strong>&apos;s referral code{" "}
                    <span className="font-mono font-bold text-indigo-700">{query.data.referredBy.code}</span>. Complete your first service booking to receive an instant{" "}
                    <strong className="font-semibold text-emerald-700">{money(query.data.referredBy.rewardPaise || 5000)}</strong> wallet credit!
                  </>
                )}
              </p>

              {/* Action Button: Full-width pill */}
              <div className="relative z-10 w-full">
                {query.data.referredBy.status === "rewarded" ? (
                  <Link
                    to="/customer/wallet"
                    className="hcx-referral-cta hcx-referral-pill-btn flex items-center justify-center gap-2 w-full rounded-full bg-[#272069] hover:bg-[#1e1855] text-white !text-white px-6 py-3.5 text-sm sm:text-base font-bold shadow-md hover:shadow-lg transition-all !no-underline"
                    style={{ color: "#ffffff" }}
                  >
                    <Wallet size={16} className="text-white shrink-0" aria-hidden="true" />
                    <span className="text-white font-bold tracking-wide">View Wallet</span>
                    <ArrowRight size={16} className="text-white shrink-0" aria-hidden="true" />
                  </Link>
                ) : query.data.referredBy.status === "completed" ? (
                  <Link
                    to="/customer/wallet"
                    className="hcx-referral-cta hcx-referral-pill-btn flex items-center justify-center gap-2 w-full rounded-full bg-[#272069] hover:bg-[#1e1855] text-white !text-white px-6 py-3.5 text-sm sm:text-base font-bold shadow-md hover:shadow-lg transition-all !no-underline"
                    style={{ color: "#ffffff" }}
                  >
                    <Wallet size={16} className="text-white shrink-0" aria-hidden="true" />
                    <span className="text-white font-bold tracking-wide">View Wallet</span>
                    <ArrowRight size={16} className="text-white shrink-0" aria-hidden="true" />
                  </Link>
                ) : (
                  <Link
                    to="/customer/services"
                    className="hcx-referral-cta hcx-referral-pill-btn flex items-center justify-center gap-2 w-full rounded-full bg-[#272069] hover:bg-[#1e1855] text-white !text-white px-6 py-3.5 text-sm sm:text-base font-bold shadow-md hover:shadow-lg transition-all !no-underline"
                    style={{ color: "#ffffff" }}
                  >
                    <span className="text-white font-bold tracking-wide">Book a Service</span>
                    <ArrowRight size={16} className="text-white shrink-0" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </section>
          )}

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

          <div className="hcx-support-panel">
            <ReferralCard data={query.data} />
          </div>

          <section className="hcx-support-panel hcx-support-referral-history">
            <h2>Referral activity</h2>
            {query.data.entries.length ? (
              <ul className="hcx-support-ticket-list">
                {query.data.entries.map((entry, i) => {
                  const friendName =
                    entry.referee?.name ||
                    entry.friendName ||
                    `Invitation ${(page - 1) * 10 + i + 1}`;
                  const friendContact =
                    entry.referee?.email ||
                    entry.friendEmail ||
                    entry.referee?.phone ||
                    entry.friendPhone;
                  const friendAvatar =
                    entry.referee?.avatar || entry.friendAvatar;
                  const initial = (friendName.trim()[0] || "F").toUpperCase();

                  return (
                    <li key={entry.id} className="hcx-support-ticket">
                      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-2xs ring-2 ring-indigo-100 overflow-hidden select-none">
                          {friendAvatar ? (
                            <img
                              src={friendAvatar}
                              alt={friendName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{initial}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                            {friendName}
                          </h3>
                          {friendContact && (
                            <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                              {friendContact}
                            </p>
                          )}
                          <time
                            dateTime={entry.createdAt}
                            className="text-[11px] sm:text-xs text-slate-400 mt-1 block"
                          >
                            Joined {when(entry.createdAt)}
                          </time>
                        </div>
                      </div>
                      <div className="hcx-support-ticket-meta">
                        <span
                          className={clsx(
                            "hcx-support-badge",
                            entry.status === "rewarded"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : entry.status === "completed"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          )}
                        >
                          {entry.status === "rewarded"
                            ? "Reward credited"
                            : entry.status === "completed"
                              ? "Reward pending"
                              : "Awaiting first booking"}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          {entry.status === "rewarded"
                            ? money(entry.rewardPaise)
                            : "Not credited yet"}
                        </span>
                      </div>
                    </li>
                  );
                })}
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
      )}
    </div>
  );
}