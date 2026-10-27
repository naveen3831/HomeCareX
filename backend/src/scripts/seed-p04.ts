/**
 * Creates ONE real booking assigned to the Test Partner, so the P04 pages (navigation, live location,
 * chat, masked call) can be tried against your database.
 *
 * Needs partner@homecarex.com and customer@homecarex.com to exist already.
 *
 *   npm run seed -- p04                      (status en_route, the default)
 *   npm run seed -- p04 --status=assigned    (start at the "On the way" step)
 *
 * Safe to re-run: the same booking is reset to the chosen status, never duplicated. Dev / staging only.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { BookingModel } from "../models/Booking";
import { PartnerModel } from "../models/Partner";
import { UserModel } from "../models/User";

dotenv.config();

const ALLOWED = ["assigned", "en_route", "arrived", "in_progress"] as const;
type SeedStatus = (typeof ALLOWED)[number];

const statusArg =
  process.argv.find((a) => a.startsWith("--status="))?.split("=")[1] ??
  "en_route";
const IDEMPOTENCY_KEY = "p04-demo-booking";

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Refusing to seed demo data in production.");
  if (!(ALLOWED as readonly string[]).includes(statusArg))
    throw new Error(`--status must be one of: ${ALLOWED.join(", ")}`);
  const status = statusArg as SeedStatus;
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("DATABASE_URL is not set (see backend/.env.example).");

  await mongoose.connect(url);

  const partnerUser = await UserModel.findOne({
    email: "partner@homecarex.com",
  })
    .select("_id name phone")
    .lean();
  const customer = await UserModel.findOne({ email: "customer@homecarex.com" })
    .select("_id name phone")
    .lean();
  if (!partnerUser || !customer)
    throw new Error('Test users not found. Run "npm run seed -- users" first.');

  // The Partner profile (Partner._id) is what Booking.partnerId points to, not the User id.
  await PartnerModel.updateOne(
    { userId: partnerUser._id },
    { $set: { status: "active", "kyc.status": "approved", trainingCompleted: true } },
    { upsert: true },
  );
  const partner = await PartnerModel.findOne({ userId: partnerUser._id })
    .select("_id")
    .lean();
  if (!partner) throw new Error("Could not create the partner profile.");

  const now = new Date();
  const booking = await BookingModel.findOneAndUpdate(
    { customerId: customer._id, idempotencyKey: IDEMPOTENCY_KEY },
    {
      $set: {
        partnerId: partner._id,
        serviceName: "Deep Home Cleaning",
        customerName: customer.name,
        quantity: 1,
        address: {
          line1: "Flat 402, Sai Residency, Road No. 3",
          area: "Gachibowli",
          city: "Hyderabad",
          pincode: "500032",
          // GeoJSON order is [lng, lat].
          location: { type: "Point", coordinates: [78.3489, 17.4401] },
        },
        scheduledAt: new Date(now.getTime() + 60 * 60 * 1000),
        priceBreakdown: {
          base: 1499,
          addOns: 0,
          surge: 0,
          discount: 0,
          convenienceFee: 0,
          tax: 0,
          total: 1499,
        },
        partnerEarning: 1200,
        status,
        paymentStatus: "PAID",
        statusHistory: [
          { from: null, to: "assigned", at: now, actorRole: "system" },
          ...(status === "assigned"
            ? []
            : [
                {
                  from: "assigned",
                  to: status,
                  at: now,
                  actorRole: "partner",
                  actorId: String(partnerUser._id),
                },
              ]),
        ],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const id = String(booking._id);
  console.log("\nP04 demo booking ready");
  console.log(`  booking id : ${id}`);
  console.log(`  status     : ${status}`);
  console.log(
    `  partner    : partner@homecarex.com   (phone ${partnerUser.phone ?? "NOT SET"})`,
  );
  console.log(
    `  customer   : customer@homecarex.com  (phone ${customer.phone ?? "NOT SET"})`,
  );
  console.log(
    `\nOpen as the partner:   http://localhost:3000/partner/jobs/${id}/navigation`,
  );
  console.log(
    `Location page:         http://localhost:3000/partner/jobs/${id}/location`,
  );
  console.log(`Postman variable:      bookingId = ${id}\n`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
