import { Types } from 'mongoose';
import { NotificationModel } from '../../models/Notification';
import { emitToUser } from '../../sockets';
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_SOCKET_EVENT,
  groupOf,
  type NotificationGroup,
  type NotificationType,
} from './notifications.constants';
import { HttpError } from '../auth/auth.types';

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

export class NotificationsService {
  notify = notify;

  async listForUser(userId: string, limit = 30) {
    const rows = await NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(limit);
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

  /* ---------------- Customer-specific API ---------------- */

  async listForCustomer(
    userId: string,
    opts: { group?: NotificationGroup; unreadOnly?: boolean; limit?: number } = {},
  ) {
    const limit = opts.limit ?? 50;
    const filter: Record<string, unknown> = { userId };
    if (opts.unreadOnly) {
      filter.readAt = null;
    }

    const rows = await NotificationModel.find(filter).sort({ createdAt: -1 }).limit(limit * 4);
    let items = rows.map((r) => toDto(r as never));

    if (opts.group) {
      items = items.filter((x) => x.group === opts.group);
    }
    items = items.slice(0, limit);

    // Group counts
    const aggResult = await NotificationModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
    ]);

    const groups: Record<NotificationGroup, { total: number; unread: number }> = {
      booking: { total: 0, unread: 0 },
      offers: { total: 0, unread: 0 },
      partner: { total: 0, unread: 0 },
      payment: { total: 0, unread: 0 },
      support: { total: 0, unread: 0 },
      system: { total: 0, unread: 0 },
    };

    let totalUnread = 0;
    if (Array.isArray(aggResult)) {
      for (const row of aggResult as { _id: string; total: number; unread: number }[]) {
        const grp = groupOf(row._id);
        groups[grp].total += row.total;
        groups[grp].unread += row.unread;
        totalUnread += row.unread;
      }
    }

    return {
      items,
      unread: totalUnread,
      groups,
    };
  }

  async markReadForCustomer(userId: string, id: string) {
    if (!/^[a-f0-9]{24}$/i.test(id)) {
      throw new HttpError(400, 'Invalid notification id', 'VALIDATION_ERROR');
    }
    const doc = await NotificationModel.findOne({ _id: id, userId });
    if (!doc) {
      throw new HttpError(404, 'Notification not found', 'NOT_FOUND');
    }
    if (doc.readAt === null) {
      doc.readAt = new Date();
      await doc.save();
    }
    return toDto(doc as never);
  }

  async markAllReadForCustomer(userId: string) {
    const res = await NotificationModel.updateMany(
      { userId, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return res.modifiedCount ?? 0;
  }

  async deleteForCustomer(userId: string, id: string) {
    if (!/^[a-f0-9]{24}$/i.test(id)) {
      throw new HttpError(400, 'Invalid notification id', 'VALIDATION_ERROR');
    }
    const res = await NotificationModel.deleteOne({ _id: id, userId });
    if (!res || res.deletedCount === 0) {
      throw new HttpError(404, 'Notification not found', 'NOT_FOUND');
    }
    return true;
  }

  async deleteAllForCustomer(userId: string) {
    const res = await NotificationModel.deleteMany({ userId });
    return res.deletedCount ?? 0;
  }
}

export const notificationsService = new NotificationsService();
