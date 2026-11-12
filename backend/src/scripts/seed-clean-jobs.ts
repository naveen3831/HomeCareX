/**
 * Wipes every job / job request tied to the test partner and leaves EXACTLY TWO open requests
 * (status searching_for_partner, pending offer to the partner, each expires in 24h).
 *
 *   npm run seed -- clean-jobs
 *
 * Two are needed on purpose: a tester can accept one and still has a second one left to reject
 * ("Reject job" can never be tried if the only offer was already accepted).
 *
 * Needs partner@homecarex.com and customer@homecarex.com (npm run seed -- users). Dev / staging only.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { BookingModel } from "../models/Booking";
import { PartnerModel } from "../models/Partner";
import { UserModel } from "../models/User";

dotenv.config();

const HOUR = 60 * 60 * 1000;

/** The open requests to create. Add a row here to seed more. */
const REQUESTS = [
  {
    key: "a",
    serviceName: "Deep Home Cleaning",
    address: {
      line1: "Flat 402, Sai Residency, Road No. 3",
      area: "Gachibowli",
      city: "Hyderabad",
      pincode: "500032",
      coordinates: [78.3489, 17.4401],
    },
    startsInHours: 3,
    total: 1499,
    partnerEarning: 1200,
  },
  {
    key: "b",
    serviceName: "AC Service & Repair",
    address: {
      line1: "Plot 18, Lake View Colony, Road No. 12",
      area: "Madhapur",
      city: "Hyderabad",
      pincode: "500081",
      coordinates: [78.3915, 17.4483],
    },
    startsInHours: 5,
    total: 899,
    partnerEarning: 700,
  },
] as const;

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Refusing to seed demo data in production.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  await mongoose.connect(url);

  const partnerUser = await UserModel.findOne({ email: "partner@homecarex.com" }).select("_id").lean();
  const customer = await UserModel.findOne({ email: "customer@homecarex.com" }).select("_id name").lean();
  if (!partnerUser || !customer) throw new Error('Test users not found. Run "npm run seed -- users" first.');

  await PartnerModel.updateOne(
    { userId: partnerUser._id },
    { $set: { status: "active", "kyc.status": "approved", trainingCompleted: true } },
    { upsert: true },
  );
  const partner = await PartnerModel.findOne({ userId: partnerUser._id }).select("_id").lean();
  if (!partner) throw new Error("Could not create the partner profile.");

  const removed = await BookingModel.deleteMany({
    $or: [{ partnerId: partner._id }, { "offers.partnerId": partner._id }],
  });
  console.log(`Removed ${removed.deletedCount} partner jobs/requests`);

  const now = new Date();
  const created: string[] = [];

  for (const r of REQUESTS) {
    const booking = await BookingModel.create({
      customerId: customer._id,
      idempotencyKey: `clean-jobs-request-${r.key}-${now.getTime()}`,
      serviceName: r.serviceName,
      customerName: customer.name,
      quantity: 1,
      address: {
        line1: r.address.line1,
        area: r.address.area,
        city: r.address.city,
        pincode: r.address.pincode,
        location: { type: "Point", coordinates: [...r.address.coordinates] },
      },
      scheduledAt: new Date(now.getTime() + r.startsInHours * HOUR),
      priceBreakdown: { base: r.total, addOns: 0, surge: 0, discount: 0, convenienceFee: 0, tax: 0, total: r.total },
      partnerEarning: r.partnerEarning,
      status: "searching_for_partner",
      paymentStatus: "PAID",
      offers: [
        {
          partnerId: partner._id,
          offeredAt: now,
          expiresAt: new Date(now.getTime() + 24 * HOUR),
          response: "pending",
        },
      ],
      statusHistory: [{ from: null, to: "searching_for_partner", at: now, actorRole: "system" }],
    });
    created.push(`${r.serviceName} (${booking._id})`);
  }

  console.log(`Created ${created.length} open requests:`);
  for (const line of created) console.log(`  - ${line}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
