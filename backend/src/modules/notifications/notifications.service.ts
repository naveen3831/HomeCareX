
import mongoose, { Types } from 'mongoose';

import { NotificationModel } from '../../models/Notification';
import { UserModel } from '../../models/User';
import { getSetting } from '../settings';
import { HttpError } from '../auth/auth.types';
import { emitToUser } from '../../sockets';

import {
  ADMIN_ALERT_SETTING,
  NOTIFICATION_GROUPS,
  GROUP_PREFIXES,
  NOTIFICATION_SOCKET_EVENT,
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
  groups: Record<NotificationGroup, { total: number; unread: number }>;
}

export interface CustomerNotificationQuery {
  group?: NotificationGroup;
  unreadOnly?: boolean;
  limit: number;
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const prefixRegex = (prefixes: readonly string[]): RegExp =>
  new RegExp(`^(?:${prefixes.map(escapeRegex).join('|')})`);

/**
 * Defensive fallback prevents startup from crashing if GROUP_PREFIXES
 * is temporarily undefined. The constants export should still be verified.
 */
const groupPrefixes =
  GROUP_PREFIXES && typeof GROUP_PREFIXES === 'object'
    ? GROUP_PREFIXES
    : ({} as typeof GROUP_PREFIXES);

const ALL_PREFIXES: string[] = Object.values(groupPrefixes).flat() as string[];

/** Mongo filter for one notification group. */
export function groupFilter(
  group: NotificationGroup,
): Record<string, unknown> {
  if (group === 'system') {
    return {
      type: {
        $not: ALL_PREFIXES.length
          ? prefixRegex(ALL_PREFIXES)
          : /^$/,
      },
    };
  }

  const prefixes = groupPrefixes[group];

  if (!Array.isArray(prefixes) || prefixes.length === 0) {
    return { type: /^$/ };
  }

  return { type: prefixRegex(prefixes) };
}

function toDto(
  notification: InstanceType<typeof NotificationModel>,
): NotificationDto {
  return {
    id: notification.id,
    userId: String(notification.userId),
    type: notification.type,
    payload: notification.payload,
    readAt: notification.readAt ?? null,
    createdAt: (notification as unknown as { createdAt: Date }).createdAt,
  };
}

/**
 * Saves a notification and pushes it to the user's socket room.
 * Socket failures do not fail the caller after the notification is saved.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown> = {},
): Promise<NotificationDto> {
  const document = await NotificationModel.create({
    userId,
    type,
    payload,
  });

  const dto = toDto(document);

  try {
    emitToUser(userId, NOTIFICATION_SOCKET_EVENT, dto);
  } catch {
    // Sockets may not be initialized in scripts or tests.
  }

  return dto;
}

/**
 * Sends a notification to every active admin.
 * Disabled admin alert settings are respected, except for SOS alerts.
 */
export async function notifyAdmins(
  type: NotificationType,
  payload: Record<string, unknown> = {},
): Promise<number> {
  if (mongoose.connection.readyState !== 1) {
    return 0;
  }

  const settingKey = ADMIN_ALERT_SETTING[type];
  const enabled: unknown = settingKey
    ? await getSetting(settingKey)
    : true;

  if (enabled === false) {
    return 0;
  }

  const admins = await UserModel.find({
    role: 'admin',
    status: 'active',
  })
    .select('_id')
    .lean();

  await Promise.all(
    admins.map((admin) =>
      notify(String(admin._id), type, payload),
    ),
  );

  return admins.length;
}

export class NotificationsService {
  notify = notify;

  async listForUser(
    userId: string,
    limit = 30,
    unreadOnly = false,
  ): Promise<NotificationDto[]> {
    const rows = await NotificationModel.find({
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);

    return rows.map(toDto);
  }

  unreadCount(userId: string) {
    return NotificationModel.countDocuments({
      userId,
      readAt: null,
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      return;
    }

    await NotificationModel.updateOne(
      { _id: id, userId, readAt: null },
      { $set: { readAt: new Date() } },
    );
  }

  /**
   * Lists the current customer's notifications and unread counts by group.
   */
  async listForCustomer(
    userId: string,
    query: CustomerNotificationQuery,
  ): Promise<CustomerNotificationsResult> {
    const filter: Record<string, unknown> = { userId };

    if (query.group) {
      Object.assign(filter, groupFilter(query.group));
    }

    if (query.unreadOnly) {
      filter.readAt = null;
    }

    const [rows, byType] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(query.limit),

      NotificationModel.aggregate<{
        _id: string;
        total: number;
        unread: number;
      }>([
        { $match: { userId: new Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$type',
            total: { $sum: 1 },
            unread: {
              $sum: {
                $cond: [{ $eq: ['$readAt', null] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const groups = Object.fromEntries(
      NOTIFICATION_GROUPS.map((group) => [
        group,
        { total: 0, unread: 0 },
      ]),
    ) as CustomerNotificationsResult['groups'];

    for (const row of byType) {
      const group = groupOf(row._id);
      groups[group].total += row.total;
      groups[group].unread += row.unread;
    }

    const unread = NOTIFICATION_GROUPS.reduce(
      (sum, group) => sum + groups[group].unread,
      0,
    );

    return {
      items: rows.map((notification) => ({
        ...toDto(notification),
        group: groupOf(notification.type),
      })),
      unread,
      groups,
    };
  }

  /** Marks one of the current customer's notifications as read. */
  async markReadForCustomer(
    userId: string,
    id: string,
  ): Promise<CustomerNotificationDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        400,
        'Invalid notification id',
        'VALIDATION_ERROR',
      );
    }

    const notification = await NotificationModel.findOne({
      _id: id,
      userId,
    });

    if (!notification) {
      throw new HttpError(
        404,
        'Notification not found',
        'NOT_FOUND',
      );
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return {
      ...toDto(notification),
      group: groupOf(notification.type),
    };
  }

  /** Marks all unread notifications belonging to this customer as read. */
  async markAllReadForCustomer(userId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      { userId, readAt: null },
      { $set: { readAt: new Date() } },
    );

    return result.modifiedCount;
  }

  /** Deletes one of the current customer's notifications. */
  async deleteForCustomer(
    userId: string,
    id: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        400,
        'Invalid notification id',
        'VALIDATION_ERROR',
      );
    }

    const result = await NotificationModel.deleteOne({
      _id: id,
      userId,
    });

    if (result.deletedCount === 0) {
      throw new HttpError(
        404,
        'Notification not found',
        'NOT_FOUND',
      );
    }
  }

  /** Deletes every notification belonging to this customer. */
  async deleteAllForCustomer(userId: string): Promise<number> {
    const result = await NotificationModel.deleteMany({ userId });
    return result.deletedCount;
  }

  async markAllRead(userId: string): Promise<void> {
    await NotificationModel.updateMany(
      { userId, readAt: null },
      { $set: { readAt: new Date() } },
    );
  }
}

export const notificationsService = new NotificationsService();

export default notificationsService;
