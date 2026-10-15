/**
 * Seeds demo support tickets (+ messages) so Admin > Support has rows to show.
 * Safe to re-run: a ticket is only created if its subject does not exist yet.
 *   npm run seed -- tickets        (run `npm run seed:users` first)
 * Dev / staging only.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { UserModel } from '../models/User';
import { BookingModel } from '../models/Booking';
import { TicketModel } from '../models/Ticket';
import { TicketMessageModel } from '../modules/tickets/TicketMessage';
import type { TicketCategory, TicketPriority, TicketStatus } from '../modules/tickets/tickets.constants';

dotenv.config();

const HOUR = 3_600_000;

interface Demo {
  role: 'customer' | 'partner';
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  ageHours: number; // how old the ticket is (drives the SLA badge)
  withBooking: boolean;
  messages: { from: 'requester' | 'admin'; body: string; internal?: boolean }[];
}

const DEMOS: Demo[] = [
  {
    role: 'customer', subject: 'Charged twice for my AC service', category: 'payment', priority: 'high',
    status: 'open', ageHours: 7, withBooking: true,
    messages: [{ from: 'requester', body: 'I was charged twice for the same booking. Please check and refund the extra amount.' }],
  },
  {
    role: 'customer', subject: 'Partner did not arrive on time', category: 'booking', priority: 'normal',
    status: 'in_progress', ageHours: 10, withBooking: true,
    messages: [
      { from: 'requester', body: 'The technician is 2 hours late and not picking up calls.' },
      { from: 'admin', body: 'Sorry about that, we are checking with the partner right now.' },
      { from: 'admin', body: 'Partner confirmed traffic delay. Offer a credit if the customer asks.', internal: true },
    ],
  },
  {
    role: 'partner', subject: 'Payout not received for last week', category: 'payment', priority: 'urgent',
    status: 'open', ageHours: 5, withBooking: false,
    messages: [{ from: 'requester', body: 'My weekly payout has not reached my bank account yet.' }],
  },
  {
    role: 'customer', subject: 'Cannot update my phone number', category: 'account', priority: 'low',
    status: 'resolved', ageHours: 30, withBooking: false,
    messages: [
      { from: 'requester', body: 'The app shows an error when I change my number.' },
      { from: 'admin', body: 'Fixed from our side, please try again.' },
    ],
  },
];

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed tickets in production.');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see backend/.env.example).');
  await mongoose.connect(url);

  const [admin, customer, partner] = await Promise.all([
    UserModel.findOne({ role: 'admin' }).select('_id').lean(),
    UserModel.findOne({ role: 'customer' }).select('_id').lean(),
    UserModel.findOne({ role: 'partner' }).select('_id').lean(),
  ]);
  if (!admin || !customer || !partner) throw new Error('Need an admin, customer and partner user. Run `npm run seed:users` first.');

  const booking = await BookingModel.findOne({ customerId: customer._id }).sort({ createdAt: -1 }).select('_id').lean();
  if (!booking) console.log('  (no booking found for the customer: tickets are created without booking context)');

  let created = 0;
  for (const d of DEMOS) {
    if (await TicketModel.exists({ subject: d.subject })) continue;
    const requester = d.role === 'customer' ? customer._id : partner._id;
    const createdAt = new Date(Date.now() - d.ageHours * HOUR);

    const ticket = await TicketModel.create({
      createdBy: requester,
      createdByRole: d.role,
      bookingId: d.withBooking && booking ? booking._id : null,
      category: d.category,
      subject: d.subject,
      status: d.status,
      priority: d.priority,
      assignedTo: d.status === 'in_progress' || d.status === 'resolved' ? admin._id : null,
      lastMessageAt: createdAt,
      createdAt,
    });

    let at = createdAt.getTime();
    for (const m of d.messages) {
      at += 10 * 60_000;
      await TicketMessageModel.create({
        ticketId: ticket._id,
        senderId: m.from === 'admin' ? admin._id : requester,
        senderRole: m.from === 'admin' ? 'admin' : d.role,
        body: m.body,
        isInternal: m.internal === true,
        createdAt: new Date(at),
      });
    }
    await TicketModel.updateOne({ _id: ticket._id }, { $set: { lastMessageAt: new Date(at) } });
    created += 1;
    console.log(`  ${d.priority.padEnd(7)} ${d.status.padEnd(12)} ${d.subject}`);
  }

  console.log(`\nSeeded ${created} new ticket(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
