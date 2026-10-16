import type { TicketCategory } from './types';
export interface HelpSection {
  category: TicketCategory;
  title: string;
  summary: string;
  articles: { question: string; answer: string }[];
}
export const helpSections: HelpSection[] = [
  {
    category: 'booking',
    title: 'Bookings',
    summary: 'Find and manage a service booking.',
    articles: [
      {
        question: 'Where can I see my booking?',
        answer:
          'Open My Bookings and choose View details. You can see the service, address, date and current status there.',
      },
      {
        question: 'My booking did not confirm. What should I do?',
        answer:
          'Check My Bookings and Payments first. If the booking is missing or the payment needs checking, raise a ticket with the relevant details.',
      },
    ],
  },
  {
    category: 'payment',
    title: 'Payments',
    summary: 'Payment status, receipts and failed attempts.',
    articles: [
      {
        question: 'Where is my payment receipt?',
        answer: 'Open Payments, find the transaction and select its receipt.',
      },
      {
        question: 'I was charged but my booking is not confirmed.',
        answer:
          'Create a payment ticket and include the booking and transaction reference. You may attach a screenshot with private payment details covered.',
      },
    ],
  },
  {
    category: 'cancellation',
    title: 'Cancellations',
    summary: 'Understand your cancellation options.',
    articles: [
      {
        question: 'How can I cancel a booking?',
        answer:
          'Open the booking details and use Cancel booking when available. Review the cancellation information shown before confirming.',
      },
    ],
  },
  {
    category: 'rescheduling',
    title: 'Rescheduling',
    summary: 'Change a service date or time.',
    articles: [
      {
        question: 'Can I change my booking time?',
        answer:
          'Open the booking details and choose Reschedule when available. Select an available date and time and review the change before confirming.',
      },
    ],
  },
  {
    category: 'partner',
    title: 'Partner issues',
    summary: 'Late arrival, communication or service concerns.',
    articles: [
      {
        question: 'How do I contact my service partner?',
        answer:
          'Open the booking’s tracking or details page and use the available chat or call action. For unresolved concerns, create a partner issue ticket.',
      },
    ],
  },
  {
    category: 'account',
    title: 'Account',
    summary: 'Profile, addresses and account access.',
    articles: [
      {
        question: 'How do I update my account details?',
        answer:
          'Open Profile to edit your details and Addresses to manage saved service locations. Never share your password or OTP in a support ticket.',
      },
    ],
  },
  {
    category: 'refunds',
    title: 'Refunds',
    summary: 'Check refund progress and wallet credits.',
    articles: [
      {
        question: 'Where can I check my refund?',
        answer:
          'Check the original transaction in Payments and any refund credits in Wallet. Raise a refund ticket if you need help checking its progress.',
      },
    ],
  },
  {
    category: 'safety',
    title: 'Safety',
    summary: 'Report a concern about your service.',
    articles: [
      {
        question: 'How do I report a safety concern?',
        answer:
          'Move to a safe place and contact local emergency services if there is immediate danger. For follow-up with HomeCareX, create a safety ticket and choose an appropriate priority.',
      },
    ],
  },
];
export function searchHelp(search: string) {
  const term = search.trim().toLowerCase();
  return helpSections
    .map((section) => ({
      ...section,
      articles: section.articles.filter((article) =>
        `${section.title} ${section.summary} ${article.question} ${article.answer}`
          .toLowerCase()
          .includes(term),
      ),
    }))
    .filter((section) => section.articles.length > 0);
}
