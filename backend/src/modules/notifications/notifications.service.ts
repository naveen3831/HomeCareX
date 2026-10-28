import mongoose, { Types } from 'mongoose';
import { NotificationModel } from '../../models/Notification';
import { UserModel } from '../../models/User';
import { getSetting } from '../settings';
import { HttpError } from '../auth/auth.types';
import { emitToUser } from '../../sockets';

import {
  ADMIN_ALERT_SETTING,
  GROUP_PREFIXES,
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
}

export interface CustomerNotificationDto extends NotificationDto {
  group: NotificationGroup;
}

export interface CustomerNotificationsResult {
  items: CustomerNotificationDto[];
  unread: number;
  /** Per group: how many in total and how many are unread (every group present, zero-filled). */
  groups: Record<NotificationGroup, { total: number; unread: number }>;
}

export interface CustomerNotificationQuery {
  group?: NotificationGroup;
  unreadOnly?: boolean;
  limit: number;
}

const escapeRegex = (v: string): string => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const prefixRegex = (prefixes: readonly string[]): RegExp => new RegExp(`^(?:${prefixes.map(escapeRegex).join('|')})`);
const ALL_PREFIXES = Object.values(GROUP_PREFIXES).flat() as string[];

/** Mongo filter for one group. 'system' is everything that matches no other group's prefix. */
export function groupFilter(group: NotificationGroup): Record<string, unknown> {
  if (group === 'system') return { type: { $not: prefixRegex(ALL_PREFIXES) } };
  return { type: prefixRegex(GROUP_PREFIXES[group]) };
}

function toDto(n: InstanceType<typeof NotificationModel>): NotificationDto {
  return {
    id: n.id,
    userId: String(n.userId),
    type: n.type,
    payload: n.payload,
    readAt: n.readAt ?? null,
    createdAt: (n as unknown as { createdAt: Date }).createdAt,
  };
}

/**
 * Contract used by every module: notify(userId, type, payload).
 * Saves the notification, then pushes it to the user's socket room.
 * A socket failure (server not up yet, user offline) never fails the caller: the row is already saved.
 */
export async function notify(userId: string, type: NotificationType, payload: Record<string, unknown> = {}): Promise<NotificationDto> {
  const doc = await NotificationModel.create({ userId, type, payload });
  const dto = toDto(doc);
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
  const enabled: unknown = settingKey ? await getSetting(settingKey) : true;
  if (enabled === false) return 0;
  const admins = await UserModel.find({ role: 'admin', status: 'active' }).select('_id').lean();
  await Promise.all(admins.map((a) => notify(String(a._id), type, payload)));
  return admins.length;
}

export class NotificationsService {
  notify = notify;

  async listForUser(userId: string, limit = 30, unreadOnly = false) {
    const rows = await NotificationModel.find({ userId, ...(unreadOnly ? { readAt: null } : {}) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);
    return rows.map(toDto);
  }

  unreadCount(userId: string) {
    return NotificationModel.countDocuments({ userId, readAt: null });
  }

  async markRead(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) return;
    await NotificationModel.updateOne({ _id: id, userId, readAt: null }, { $set: { readAt: new Date() } });
  }

  /**
   * Customer notifications page: the caller's own notifications (always filtered by their id), optionally one
   * group and/or unread only, plus unread counts per group for the tab badges.
   */
  async listForCustomer(userId: string, query: CustomerNotificationQuery): Promise<CustomerNotificationsResult> {
    const filter: Record<string, unknown> = { userId };
    if (query.group) Object.assign(filter, groupFilter(query.group));
    if (query.unreadOnly) filter.readAt = null;

    const [rows, byType] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(query.limit),
      NotificationModel.aggregate<{ _id: string; total: number; unread: number }>([
        { $match: { userId: new Types.ObjectId(userId) } },
        { $group: { _id: '$type', total: { $sum: 1 }, unread: { $sum: { $cond: [{ $eq: ['$readAt', null] }, 1, 0] } } } },
      ]),
    ]);

    const groups = Object.fromEntries(NOTIFICATION_GROUPS.map((g) => [g, { total: 0, unread: 0 }])) as CustomerNotificationsResult['groups'];
    for (const row of byType) {
      const g = groupOf(row._id);
      groups[g].total += row.total;
      groups[g].unread += row.unread;
    }
    const unread = NOTIFICATION_GROUPS.reduce((sum, g) => sum + groups[g].unread, 0);
    return { items: rows.map((n) => ({ ...toDto(n), group: groupOf(n.type) })), unread, groups };
  }

  /** Marks ONE of the caller's notifications read. Someone else's id is a 404, same as a missing one. */
  async markReadForCustomer(userId: string, id: string): Promise<CustomerNotificationDto> {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Invalid notification id', 'VALIDATION_ERROR');
    const n = await NotificationModel.findOne({ _id: id, userId });
    if (!n) throw new HttpError(404, 'Notification not found', 'NOT_FOUND');
    if (!n.readAt) {
      n.readAt = new Date();
      await n.save();
    }
    return { ...toDto(n), group: groupOf(n.type) };
  }

  /** Marks all of the caller's unread notifications read; returns how many changed. */
  async markAllReadForCustomer(userId: string): Promise<number> {
    const res = await NotificationModel.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
    return res.modifiedCount;
  }

  /** Deletes ONE of the caller's notifications for good. Someone else's id is a 404, same as a missing one. */
  async deleteForCustomer(userId: string, id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(400, 'Invalid notification id', 'VALIDATION_ERROR');
    const res = await NotificationModel.deleteOne({ _id: id, userId });
    if (res.deletedCount === 0) throw new HttpError(404, 'Notification not found', 'NOT_FOUND');
  }

  /** Deletes every notification of the caller (and only theirs); returns how many were removed. */
  async deleteAllForCustomer(userId: string): Promise<number> {
    const res = await NotificationModel.deleteMany({ userId });
    return res.deletedCount;
  }

  async markAllRead(userId: string) {
    await NotificationModel.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
  }
}

export const notificationsService = new NotificationsService();