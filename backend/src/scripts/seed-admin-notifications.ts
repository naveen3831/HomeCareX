import 'dotenv/config';
import mongoose from 'mongoose';
import { NotificationModel } from '../models/Notification';
import { UserModel } from '../models/User';

/**
 * Demo data for the admin notification bell: a few notifications (one SOS) for every active admin.
 * Run: npx tsx src/scripts/seed-admin-notifications.ts
 */
async function main() {
  await mongoose.connect(process.env.DATABASE_URL as string);
  const admins = await UserModel.find({ role: 'admin', status: 'active' }).select('_id').lean();
  const now = Date.now();
  const rows = admins.flatMap((a) => [
    { type: 'sos.alert', payload: { message: 'SOS pressed by a partner on an active job', bookingId: 'demo-booking-1' }, ago: 2 },
    { type: 'booking.created', payload: { bookingId: 'demo-booking-2' }, ago: 15 },
    { type: 'ticket.reply', payload: { ticketId: 'demo-ticket-1' }, ago: 60 },
  ].map((n) => ({ userId: a._id, type: n.type, payload: n.payload, createdAt: new Date(now - n.ago * 60_000) })));
  if (rows.length) await NotificationModel.insertMany(rows);
  console.log(`Created ${rows.length} notification(s) for ${admins.length} admin(s)`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
