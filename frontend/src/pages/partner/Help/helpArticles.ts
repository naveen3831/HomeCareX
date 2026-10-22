export interface HelpArticle {
  id: string;
  topic: string;
  title: string;
  body: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "go-online",
    topic: "Getting started",
    title: "How do I go online and start receiving jobs?",
    body: "Use the Online/Offline switch in the top bar. You only receive job requests while you are online and inside your service area. Set your working hours under Availability so you are matched at the right times.",
  },
  {
    id: "accept-job",
    topic: "Jobs",
    title: "How do I accept or reject a job request?",
    body: "Open My Jobs, pick a request and choose Accept or Reject. Accept quickly: requests are offered to other nearby partners if you don't respond in time.",
  },
  {
    id: "update-status",
    topic: "Jobs",
    title: "How do I update the status of a booking?",
    body: "Open the job from My Jobs and move it through the steps (on the way, started, completed). Keeping the status current helps the customer and keeps your payout on schedule.",
  },
  {
    id: "blackout",
    topic: "Availability",
    title: "How do I block days when I'm unavailable?",
    body: "Go to Availability, then Blackout Dates, and add the days you can't work. You won't be offered jobs on those dates.",
  },
  {
    id: "earnings",
    topic: "Earnings",
    title: "Where can I see my earnings and wallet balance?",
    body: "Earnings shows what you earned per job. Wallet shows your balance and Transactions lists every credit and debit. You can export your earnings as a CSV file from the Earnings page.",
  },
  {
    id: "payout",
    topic: "Earnings",
    title: "My payout is delayed. What should I do?",
    body: "Check Transactions first to see whether the payout is pending. If it has been pending longer than expected, raise a ticket with the Payout category and include the booking ID.",
  },
  {
    id: "kyc",
    topic: "Account",
    title: "My KYC verification is pending or was rejected",
    body: "Verification can take a little time. If it was rejected, check the reason shown on your Profile, upload clearer documents and resubmit. Still stuck? Raise a ticket with the KYC category.",
  },
  {
    id: "safety",
    topic: "Safety",
    title: "What should I do if I feel unsafe during a job?",
    body: "Leave the location if you can and contact local emergency services if you are in danger. Then raise a ticket with the Safety category so our team can follow up quickly.",
  },
];
