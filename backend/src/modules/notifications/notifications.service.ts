import mongoose, { Types } from 'mongoose';
import { NotificationModel } from '../../models/Notification';
import { UserModel } from '../../models/User';
import { getSetting } from '../settings';
import { emitToUser } from '../../sockets';
import { Errors } from '../../utils/errors';
import {
  ADMIN_ALERT_SETTING,
  NOTIFICATION_GROUPS,
  NOTIFICATION_SOCKET_EVENT,
  NOTIFICATION_TYPES,
  groupOf,
  type NotificationGroup,
  type NotificationType,
} from './notifications.constants';

export interface NotificationDto {
  id: string;
  userId: string;
  type: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
  group?: NotificationGroup;
}

function toDto(n: { _id?: unknown; id?: string; userId: unknown; type: string; payload: unknown; readAt?: Date | null; createdAt: Date }): NotificationDto {
  return {
    id: String(n.id || n._id),
    userId: String(n.userId),
    type: n.type,
    payload: n.payload,
    readAt: n.readAt ?? null,
    createdAt: n.createdAt,
    group: groupOf(n.type),
  };
}

/**
 * Contract used by every module: notify(userId, type, payload).
 * Saves the notification, then pushes it to the user's socket room.
 * A socket failure (server not up yet, user offline) never fails the caller: the row is already saved.
 */
export async function notify(userId: string, type: NotificationType, payload: Record<string, unknown> = {}): Promise<NotificationDto> {
  const doc = await NotificationModel.create({ userId, type, payload });
  const dto = toDto(doc as never);
  try {
    emitToUser(userId, NOTIFICATION_SOCKET_EVENT, dto);
  } catch {
    /* sockets not initialised (scripts/tests) */
  }
  return dto;
}

/**
 * Sends one notification to every active admin (the bell on /admin). Types an admin switched off on the Settings
 * page are skipped, except SOS which is always sent. Returns how many admins were notified.
 */
export async function notifyAdmins(type: NotificationType, payload: Record<string, unknown> = {}): Promise<number> {
  if (mongoose.connection.readyState !== 1) return 0; // no database (scripts, unit tests): nothing to notify
  const settingKey = ADMIN_ALERT_SETTING[type];
  if (settingKey && !(await getSetting(settingKey))) return 0;
  const admins = await UserModel.find({ role: 'admin', status: 'active' }).select('_id').lean();
  await Promise.all(admins.map((a) => notify(String(a._id), type, payload)));
  return admins.length;
}

export class NotificationsService {
  notify = notify;

  async listForCustomer(
    userId: string,
    options: {
      group?: NotificationGroup;
      unreadOnly?: boolean;
      limit?: number;
    } = {},
  ) {
    const limit = options.limit ?? 50;
    const objectId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null;
    const baseFilter = { userId };
    const groupTypes: Record<Exclude<NotificationGroup, 'system'>, RegExp | { $in: string[] }> = {
      booking: /^booking\./,
      payment: { $in: ['payout.processed', 'refund.updated'] },
      partner: /^partner\./,
      offers: /^offer\./,
      support: /^ticket\./,
    };
    const knownTypes = [
      ...NOTIFICATION_TYPES.filter((type) => groupOf(type) !== 'system'),
      'payment.succeeded',
      'payment.failed',
      'offer.new',
    ];
    const filters: Record<string, unknown>[] = [baseFilter];

    if (options.group && options.group !== 'system') {
      const typeFilter = groupTypes[options.group];
      filters.push(
        options.group === 'payment'
          ? {
              $or: [
                { type: /^payment\./ },
                { type: { $in: ['payout.processed', 'refund.updated'] } },
              ],
            }
          : { type: typeFilter },
      );
    } else if (options.group === 'system') {
      filters.push({ type: { $nin: knownTypes } });
    }
    if (options.unreadOnly) filters.push({ readAt: null });

    const [rows, grouped] = await Promise.all([
      NotificationModel.find(filters.length === 1 ? baseFilter : { $and: filters })
        .sort({ createdAt: -1 })
        .limit(limit),
      objectId
        ? NotificationModel.aggregate<{
            _id: string;
            total: number;
            unread: number;
          }>([
            { $match: { userId: objectId } },
            {
              $group: {
                _id: '$type',
                total: { $sum: 1 },
                unread: {
                  $sum: { $cond: [{ $eq: ['$readAt', null] }, 1, 0] },
                },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const groups = Object.fromEntries(
      NOTIFICATION_GROUPS.map((group) => [group, { total: 0, unread: 0 }]),
    ) as Record<NotificationGroup, { total: number; unread: number }>;
    for (const row of grouped) {
      const group = groupOf(row._id);
      groups[group].total += row.total;
      groups[group].unread += row.unread;
    }

    const items = rows.map((row) => ({
      ...toDto(row),
      readAt: row.readAt ? row.readAt.toISOString() : null,
      group: groupOf(row.type),
    }));

    return {
      items,
      unread: Object.values(groups).reduce((total, group) => total + group.unread, 0),
      groups,
    };
  }

  async markReadForCustomer(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw Errors.validation([{ field: 'id', message: 'Invalid notification id' }]);
    }
    const notification = await NotificationModel.findOne({
      _id: id,
      userId,
    });
    if (!notification) throw Errors.notFound('NOT_FOUND', 'Notification not found');
    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }
    return {
      ...toDto(notification),
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      group: groupOf(notification.type),
    };
  }

  async markAllReadForCustomer(userId: string) {
    const result = await NotificationModel.updateMany(
      { userId, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return result.modifiedCount;
  }

  async deleteForCustomer(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw Errors.validation([{ field: 'id', message: 'Invalid notification id' }]);
    }
    const result = await NotificationModel.deleteOne({ _id: id, userId });
    if (!result.deletedCount) throw Errors.notFound('NOT_FOUND', 'Notification not found');
  }

  async deleteAllForCustomer(userId: string) {
    const result = await NotificationModel.deleteMany({ userId });
    return result.deletedCount;
  }

  async listForUser(userId: string, limit = 30, unreadOnly = false) {
    const rows = await NotificationModel.find({ userId, ...(unreadOnly ? { readAt: null } : {}) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);
    return rows.map((r) => toDto(r as never));
  }

  unreadCount(userId: string) {
    return NotificationModel.countDocuments({ userId, readAt: null });
  }

  async markRead(userId: string, id: string) {
    await NotificationModel.updateOne({ _id: id, userId, readAt: null }, { $set: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await NotificationModel.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
  }
}

export const notificationsService = new NotificationsService();
