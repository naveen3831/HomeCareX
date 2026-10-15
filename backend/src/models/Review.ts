import { Schema, model, type InferSchemaType, Types } from 'mongoose';
import { REVIEW_TAGS } from '../modules/reviews/reviews.constants';

const ReviewSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    customerEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    /**
     * The review text (API name: `comment`). Required for site-wide testimonials (the legacy POST /reviews
     * schema enforces min 20 chars); optional for booking reviews, where the stars + tags are enough.
     */
    message: { type: String, trim: true, maxlength: 2000, alias: 'comment' },
    status: { type: String, required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    /**
     * Service details page (n04). Both links are optional so the existing site-wide testimonials
     * (no service) keep working. A review is "visible" on a service page when it is approved and
     * its serviceId matches.
     */
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    /** Partner who did the job (copied from the booking). Feeds Partner.ratingAvg / ratingCount. */
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', index: true },
    /** Quick-pick tags from the review form, e.g. 'On time'. */
    tags: { type: [{ type: String, enum: REVIEW_TAGS }], default: [] },
    /** Admin kill-switch: false hides the review everywhere and drops it from the partner's rating. */
    visible: { type: Boolean, default: true, index: true },
    /** Set by the server only: true when the review comes from a completed booking of this service. */
    verified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ReviewSchema.index({ createdAt: -1 });
/** Powers GET /services/:id/reviews (visible reviews of one service, newest first) and its star distribution. */
ReviewSchema.index({ serviceId: 1, status: 1, createdAt: -1 });
/** One review per booking. Partial, so reviews without a booking are never constrained. */
ReviewSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { bookingId: { $type: 'objectId' } } });

export type Review = InferSchemaType<typeof ReviewSchema> & { _id: Types.ObjectId };
export const ReviewModel = model('Review', ReviewSchema);
export default ReviewModel;
