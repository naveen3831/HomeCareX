
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Types } from 'mongoose';

import { adminBookingsController } from './admin-bookings.controller';
import { auditService } from '../audit/audit.service';
import { BookingModel } from '../../models/Booking';
import { PartnerModel } from '../../models/Partner';
import { PaymentModel } from '../../models/Payment';
import { UserModel } from '../../models/User';
import { getAuthUser } from '../../middleware/auth.middleware';
import { getRazorpay } from '../../integrations/razorpay';

const bookingId = new Types.ObjectId().toString();
const partnerId = new Types.ObjectId().toString();
const partnerUserId = new Types.ObjectId().toString();
const categoryId = new Types.ObjectId().toString();
const adminId = new Types.ObjectId().toString();

const original = {
  recordAudit: auditService.recordAudit,
  getAuthUser,
  bookingFindById: BookingModel.findById,
  bookingFindOne: BookingModel.findOne,
  bookingUpdateOne: BookingModel.updateOne,
  partnerFindById: PartnerModel.findById,
  userFindById: UserModel.findById,
  paymentFindOne: PaymentModel.findOne,
  getRazorpay,
};

afterEach(() => {
  auditService.recordAudit = original.recordAudit;
  BookingModel.findById = original.bookingFindById;
  BookingModel.findOne = original.bookingFindOne;
  BookingModel.updateOne = original.bookingUpdateOne;
  PartnerModel.findById = original.partnerFindById;
  UserModel.findById = original.userFindById;
  PaymentModel.findOne = original.paymentFindOne;

  (getAuthUser as any) = original.getAuthUser;
  (getRazorpay as any) = original.getRazorpay;
});

function makeRequest(
  body: Record<string, unknown>,
  params: Record<string, string> = { bookingId },
) {
  return {
    params,
    body,
    query: {},
    ip: '127.0.0.1',
    headers: {},
    get: () => undefined,
  } as any;
}

function makeResponse() {
  const response: any = {
    statusCode: 200,
    body: undefined,

    status(code: number) {
      this.statusCode = code;
      return this;
    },

    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response;
}

function makeBooking(overrides: Record<string, any> = {}) {
  return {
    _id: new Types.ObjectId(bookingId),
    customerId: new Types.ObjectId(),
    customerName: 'Test Customer',
    categoryId: new Types.ObjectId(categoryId),
    serviceName: 'Home Cleaning',
    partnerId: null,
    status: 'searching_for_partner',
    statusHistory: [],
    address: { city: 'Hyderabad' },
    scheduledAt: new Date('2026-10-25T10:00:00.000Z'),
    date: '2026-10-25',
    slot: '10:00 AM - 11:00 AM',
    priceBreakdown: { total: 500 },
    createdAt: new Date(),
    updatedAt: new Date(),
    save: async () => undefined,
    ...overrides,
  } as any;
}

function mockAuth() {
  (getAuthUser as any) = () => ({
    id: adminId,
    role: 'admin',
  });
}

function mockEmptyConflict() {
  (BookingModel.findOne as any) = () => ({
    select() {
      return this;
    },

    sort() {
      return this;
    },

    lean() {
      return this;
    },

    exec: async () => null,
  });
}

function mockNoPayment() {
  (PaymentModel.findOne as any) = () => ({
    sort() {
      return this;
    },

    select() {
      return this;
    },

    lean() {
      return this;
    },

    exec: async () => null,

    then(
      resolve: (value: any) => any,
      reject?: (reason: any) => any,
    ) {
      return Promise.resolve(null).then(resolve, reject);
    },
  });
}

function mockActivePartnerUser() {
  (UserModel.findById as any) = () => ({
    lean() {
      return this;
    },

    exec: async () => ({
      status: 'active',
      name: 'Test Partner',
    }),

    then(
      resolve: (value: any) => any,
      reject?: (reason: any) => any,
    ) {
      return Promise.resolve({
        status: 'active',
        name: 'Test Partner',
      }).then(resolve, reject);
    },
  });
}

function makeApprovedPartner() {
  return {
    _id: new Types.ObjectId(partnerId),
    userId: new Types.ObjectId(partnerUserId),
    categories: [new Types.ObjectId(categoryId)],
    kyc: { status: 'approved' },
    trainingCompleted: true,
  } as any;
}

/**
 * Supports PartnerModel.findById(...).lean().exec()
 * and promise-style query handling.
 */
function mockPartnerFindById() {
  (PartnerModel.findById as any) = () => ({
    lean() {
      return this;
    },

    exec: async () => makeApprovedPartner(),

    then(
      resolve: (value: any) => any,
      reject?: (reason: any) => any,
    ) {
      return Promise.resolve(makeApprovedPartner()).then(resolve, reject);
    },
  });
}

test('admin partner assignment records before and after snapshots', async () => {
  mockAuth();
  mockEmptyConflict();
  mockNoPayment();
  mockPartnerFindById();
  mockActivePartnerUser();

  let recorded: any;

  const booking = makeBooking({
    status: 'searching_for_partner',
  });

  (BookingModel.findById as any) = async () => booking;

  (auditService.recordAudit as any) = async (input: any) => {
    recorded = input;
    return input;
  };

  const response = makeResponse();

  await adminBookingsController.assignPartner(
    makeRequest({
      partnerId,
      reason: 'Customer requested reassignment',
    }),
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(recorded.action, 'booking.partner_assigned');
  assert.equal(recorded.entity, 'Booking');
  assert.equal(recorded.entityId, bookingId);
  assert.equal(recorded.actor, adminId);
  assert.equal(recorded.ip, '127.0.0.1');
  assert.equal(recorded.result, 'Success');

  assert.equal(recorded.before.partnerId, null);
  assert.equal(recorded.before.status, 'searching_for_partner');

  assert.equal(recorded.after.partnerId, partnerId);
  assert.equal(recorded.after.status, 'assigned');
  assert.equal(
    recorded.after.reason,
    'Customer requested reassignment',
  );
});

test('admin status override records previous and new status', async () => {
  mockAuth();

  let recorded: any;

  const booking = makeBooking({
    status: 'in_progress',
  });

  (BookingModel.findById as any) = async () => booking;

  (BookingModel.updateOne as any) = () => ({
    exec: async () => ({
      acknowledged: true,
      modifiedCount: 1,
    }),
  });

  (auditService.recordAudit as any) = async (input: any) => {
    recorded = input;
    return input;
  };

  const response = makeResponse();

  await adminBookingsController.overrideStatus(
    makeRequest({
      status: 'completed',
      reason: 'Admin verified completion',
    }),
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(recorded.action, 'booking.status_overridden');
  assert.equal(recorded.entity, 'Booking');
  assert.equal(recorded.entityId, bookingId);
  assert.equal(recorded.actor, adminId);
  assert.equal(recorded.ip, '127.0.0.1');
  assert.equal(recorded.result, 'Success');

  assert.equal(recorded.before.status, 'in_progress');
  assert.equal(recorded.after.status, 'completed');
  assert.equal(
    recorded.after.reason,
    'Admin verified completion',
  );
});

test('admin cancellation records cancellation and refund details', async () => {
  mockAuth();
  mockNoPayment();

  let recorded: any;

  const booking = makeBooking({
    status: 'confirmed',
  });

  (BookingModel.findById as any) = () => ({
    then(
      resolve: (value: any) => any,
      reject?: (reason: any) => any,
    ) {
      return Promise.resolve(booking).then(resolve, reject);
    },

    lean() {
      return this;
    },

    exec: async () => booking,
  });

  (BookingModel.updateOne as any) = () => ({
    exec: async () => ({
      acknowledged: true,
      modifiedCount: 1,
    }),
  });

  (auditService.recordAudit as any) = async (input: any) => {
    recorded = input;
    return input;
  };

  const response = makeResponse();

  await adminBookingsController.cancelBooking(
    makeRequest({
      reason: 'Duplicate booking',
    }),
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(recorded.action, 'booking.cancelled_by_admin');
  assert.equal(recorded.entity, 'Booking');
  assert.equal(recorded.entityId, bookingId);
  assert.equal(recorded.actor, adminId);
  assert.equal(recorded.ip, '127.0.0.1');
  assert.equal(recorded.result, 'Success');

  assert.equal(recorded.before.status, 'confirmed');
  assert.equal(recorded.after.status, 'cancelled_by_admin');
  assert.equal(
    recorded.after.cancellationReason,
    'Duplicate booking',
  );
  assert.equal(recorded.after.refundStatus, 'none');
  assert.equal(recorded.after.refundAmount, 0);
});

test('booking assignment still succeeds when audit recording fails', async () => {
  mockAuth();
  mockEmptyConflict();
  mockNoPayment();
  mockPartnerFindById();
  mockActivePartnerUser();

  const booking = makeBooking({
    status: 'searching_for_partner',
  });

  (BookingModel.findById as any) = async () => booking;

  (auditService.recordAudit as any) = async () => {
    throw new Error('Audit storage unavailable');
  };

  const response = makeResponse();
  const originalError = console.error;

  console.error = () => undefined;

  try {
    await adminBookingsController.assignPartner(
      makeRequest({
        partnerId,
        reason: 'Reassignment requested',
      }),
      response,
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
});
