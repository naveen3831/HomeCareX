import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose, { Types } from 'mongoose';
import { TicketModel } from '../../models/Ticket';
import { UserModel } from '../../models/User';
import BookingModel from '../../models/Booking';
import { TicketMessageModel } from './TicketMessage';
import { TicketAttachmentModel } from './TicketAttachment';
import { createTicketsService } from './tickets.service';
import { ticketsRepository } from './tickets.repository';
import { createTicketSchema } from './tickets.validation';
import { ReferralCodeModel, ReferralModel } from '../referrals/referrals.model';
import { referralsService } from '../referrals/referrals.service';
import { WalletLedgerModel, WalletModel } from '../../models/Wallet';

// Optional real database check. A fresh, unique test database is the only database deleted.
test(
  'real MongoDB: private evidence, shared models and exactly-once referral wallet credits',
  {
    skip: !process.env.TR_D14_TEST_DATABASE_URL,
  },
  async () => {
    const dbName = `homecarex_tr_d14_test_${process.pid}_${Date.now()}`;
    const previousReward = process.env.REFERRAL_REWARD_PAISE;
    await mongoose.connect(process.env.TR_D14_TEST_DATABASE_URL!, { dbName });
    const originalLedgerCreate = WalletLedgerModel.create;
    try {
      process.env.REFERRAL_REWARD_PAISE = '5000';
      await Promise.all([
        TicketModel.init(),
        TicketMessageModel.init(),
        TicketAttachmentModel.init(),
        ReferralCodeModel.init(),
        ReferralModel.init(),
        WalletModel.init(),
        WalletLedgerModel.init(),
      ]);
      const [a, b] = await UserModel.create([
        {
          name: 'Test Referrer',
          email: 'referrer@example.test',
          passwordHash: 'test-only',
          role: 'customer',
        },
        {
          name: 'Test Referee',
          email: 'referee@example.test',
          passwordHash: 'test-only',
          role: 'customer',
        },
      ]);
      const service = createTicketsService(ticketsRepository, () => {});
      const data = Buffer.from('%PDF-1.7\nTest evidence');
      const ticket = await service.create(
        String(a._id),
        createTicketSchema.parse({
          category: 'refunds',
          subject: 'Check the refund',
          body: 'Please check the refund for my booking.',
        }),
        [
          {
            name: 'evidence.pdf',
            mimeType: 'application/pdf',
            sizeBytes: data.length,
            data,
          },
        ],
      );
      const actor = { id: String(a._id), role: 'customer' as const };
      const detail = await service.get(ticket.id, actor);
      assert.equal(detail.messages.length, 1);
      const fileId = detail.messages[0].attachments[0].url.split('/').pop()!;
      assert.deepEqual(
        (await service.evidence(ticket.id, fileId, actor)).data,
        data,
      );
      await assert.rejects(
        service.evidence(ticket.id, fileId, {
          id: String(b._id),
          role: 'customer',
        }),
        { status: 404 },
      );
      await service.setStatus(ticket.id, 'waiting', {
        id: String(new Types.ObjectId()),
        role: 'admin',
      });
      await service.reply(ticket.id, actor, 'Here are the extra details.', []);
      assert.equal(
        (await service.get(ticket.id, actor)).ticket.status,
        'in_progress',
      );
      assert.equal(
        await TicketMessageModel.countDocuments({ ticketId: ticket.id }),
        2,
      );

      const code = await referralsService.code(String(a._id));
      assert.equal(await referralsService.code(String(a._id)), code);
      assert.equal(
        await referralsService.resolve(code.toLowerCase()),
        String(a._id),
      );
      await assert.rejects(
        referralsService.attach(String(a._id), code, String(a._id)),
        { code: 'SELF_REFERRAL' },
      );
      await referralsService.attach(String(b._id), code, String(a._id));
      await referralsService.attach(String(b._id), code, String(a._id));
      assert.equal(await ReferralModel.countDocuments({ refereeId: b._id }), 1);
      await referralsService.rewardForReferee(String(b._id));
      assert.equal(
        await WalletLedgerModel.countDocuments({ userId: String(a._id) }),
        0,
      );
      await BookingModel.collection.insertOne({
        customerId: b._id,
        status: 'completed',
        completedAt: new Date(),
        createdAt: new Date(),
      });
      await Promise.all(
        Array.from({ length: 6 }, () =>
          referralsService.rewardForReferee(String(b._id)),
        ),
      );
      assert.equal(
        (await WalletModel.findOne({ userId: String(a._id) }))!.balance,
        50,
      );
      assert.equal(
        await WalletLedgerModel.countDocuments({
          userId: String(a._id),
          type: 'referral_reward',
        }),
        1,
      );
      await BookingModel.collection.insertOne({
        customerId: b._id,
        status: 'completed',
        completedAt: new Date(),
        createdAt: new Date(),
      });
      await referralsService.reconcile();
      assert.equal(
        (await WalletModel.findOne({ userId: String(a._id) }))!.balance,
        50,
      );
      const summary = await referralsService.summary(String(a._id), 1);
      assert.deepEqual(summary.stats, {
        invited: 1,
        completed: 1,
        rewardsPaise: 5000,
      });

      const c = await UserModel.create({
        name: 'Rollback Test',
        email: 'rollback@example.test',
        passwordHash: 'test-only',
        role: 'customer',
      });
      await referralsService.attach(String(c._id), code, String(a._id));
      await BookingModel.collection.insertOne({
        customerId: c._id,
        status: 'completed',
        completedAt: new Date(),
        createdAt: new Date(),
      });
      WalletLedgerModel.create = (async () => {
        throw new Error('Simulated ledger write failure');
      }) as typeof WalletLedgerModel.create;
      await assert.rejects(
        referralsService.rewardForReferee(String(c._id)),
        /Simulated ledger write failure/,
      );
      WalletLedgerModel.create = originalLedgerCreate;
      assert.equal(
        (await WalletModel.findOne({ userId: String(a._id) }))!.balance,
        50,
      );
      assert.equal(
        (await ReferralModel.findOne({ refereeId: c._id }))!.status,
        'completed',
      );
      await referralsService.rewardForReferee(String(c._id));
      assert.equal(
        (await WalletModel.findOne({ userId: String(a._id) }))!.balance,
        100,
      );
      assert.equal(
        await WalletLedgerModel.countDocuments({
          userId: String(a._id),
          type: 'referral_reward',
        }),
        2,
      );
    } finally {
      WalletLedgerModel.create = originalLedgerCreate;
      if (previousReward === undefined)
        delete process.env.REFERRAL_REWARD_PAISE;
      else process.env.REFERRAL_REWARD_PAISE = previousReward;
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  },
);
