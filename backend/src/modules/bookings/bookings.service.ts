
import { createHash } from 'crypto';
import { Types } from 'mongoose';

import { AppError } from '../../utils/AppError';
import { BOOKING_PAYMENT_STATUS } from '../../models/Booking';
import { PaymentModel } from '../../models/Payment';
import { RefundModel } from '../../models/Refund';
import { ServiceModel } from '../../models/Service';

import { notifyAdmins } from '../notifications';
import { alertRefundRequested } from '../notifications/admin-alerts';
import {
  addressesService,
  type ResolvedAddress,
} from '../addresses/addresses.service';
import { calculatePricing, toQuoteCouponCode } from '../pricing/pricing.service';
import { couponsService } from '../coupons/coupons.service';
import { HttpError } from '../auth/auth.types';

import { bookingsRepository } from './bookings.repository';
import type { ListBookingsQuery } from './bookings.query';
import { bookingSettings } from './bookings.settings';
import { withSlotLock } from './bookings.lock';
import {
  buildDetailView,
  INTERNAL_KEYS,
  type PaymentInfo,
  type ServiceInfo,
} from './bookings.detail';
import {
  buildInvoiceData,
  renderInvoiceHtml,
  withPaymentRecord,
} from './bookings.invoice';
import {
  BOOKING_HOLD_MS,
  BOOKING_STATUS,
  BOOKING_WINDOW_DAYS,
  PRICE_CHANGED_TOLERANCE,
  RESCHEDULABLE_STATUSES,
  SERVICE_SLOTS,
  START_OTP_STATUS,
  type BookingStatus,
} from './bookings.constants';
import { canTransition, type StatusHistoryEntry } from './bookings.stateMachine';
import {
  computeCancellation,
  type CancellationQuote,
} from './bookings.cancel';
import type {
  CreateBookingInput,
  PriceLine,
  PriceSnapshot,
} from './bookings.types';
import {
  addDays,
  hasSlotStarted,
  isRealDate,
  nowInBookingTz,
} from './bookings.time';
