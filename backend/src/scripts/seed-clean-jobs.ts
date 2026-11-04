/**
 * Wipes every job / job request tied to the test partner and leaves EXACTLY ONE open request
 * (status searching_for_partner, pending offer to the partner, expires in 24h).
 *
 *   npm run seed -- clean-jobs
 *
 * Needs partner@homecarex.com and customer@homecarex.com (npm run seed -- users). Dev / staging only.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { BookingModel } from "../models/Booking";
import { PartnerModel } from "../models/Partner";
import { UserModel } from "../models/User";

dotenv.config();

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
  const booking = await BookingModel.create({
    customerId: customer._id,
    idempotencyKey: `clean-jobs-request-${now.getTime()}`,
    serviceName: "Deep Home Cleaning",
    customerName: customer.name,
    quantity: 1,
    address: {
      line1: "Flat 402, Sai Residency, Road No. 3",
      area: "Gachibowli",
      city: "Hyderabad",
      pincode: "500032",
      location: { type: "Point", coordinates: [78.3489, 17.4401] },
    },
    scheduledAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
    priceBreakdown: { base: 1499, addOns: 0, surge: 0, discount: 0, convenienceFee: 0, tax: 0, total: 1499 },
    partnerEarning: 1200,
    status: "searching_for_partner",
    paymentStatus: "PAID",
    offers: [
      {
        partnerId: partner._id,
        offeredAt: now,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        response: "pending",
      },
    ],
    statusHistory: [{ from: null, to: "searching_for_partner", at: now, actorRole: "system" }],
  });

  console.log(`Created 1 open request: ${booking._id}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});