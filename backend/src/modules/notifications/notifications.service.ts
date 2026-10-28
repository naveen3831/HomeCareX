import mongoose, { Types } from 'mongoose';
import { NotificationModel } from '../../models/Notification';
import { UserModel } from '../../models/User';
import { getSetting } from '../settings';
import { emitToUser } from '../../sockets';


import { HttpError } from "../auth/auth.types";
import {
  ADMIN_ALERT_SETTING,
  GROUP_PREFIXES,
  NOTIFICATION_GROUPS,
  NOTIFICATION_SOCKET_EVENT,
  groupOf,
  type NotificationGroup,
  type NotificationType,
} from "./notifications.constants";

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
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const prefixRegex = (prefixes: readonly string[]): RegExp =>
  new RegExp(
    `^(?:${prefixes.map(escapeRegex).join("|")})`,
  );

const ALL_PREFIXES = Object.values(GROUP_PREFIXES).flat() as string[];

/**
 * Creates a MongoDB filter for a notification group.
 * The system group contains notification types that do not match
 * any of the other configured group prefixes.
 */
export function groupFilter(
  group: NotificationGroup,
): Record<string, unknown> {
  if (group === "system") {
    return { type: { $not: prefixRegex(ALL_PREFIXES) } };
  }

  return { type: prefixRegex(GROUP_PREFIXES[group]) };
}

function toDto(
  notification: InstanceType<typeof NotificationModel>,
): NotificationDto {
  return {
    id: String(notification._id),
    userId: String(notification.userId),
    type: notification.type,
    payload: notification.payload,
    readAt: notification.readAt ?? null,
    createdAt: notification.createdAt,
  };
}

/**
 * Saves a notification and then pushes it to the user's socket room.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown> = {},
): Promise<NotificationDto> {
  const doc = await NotificationModel.create({
    userId,
    type,
    payload,
  });

  const dto = toDto(doc);

  try {
    emitToUser(userId, NOTIFICATION_SOCKET_EVENT, dto);
  } catch {
    // Sockets may not be initialized in scripts or tests.
  }

  return dto;
}

/**
 * Notifies active administrators unless the relevant alert is disabled.
 */
export async function notifyAdmins(
  type: NotificationType,
  payload: Record<string, unknown> = {},
): Promise<number> {
  if (mongoose.connection.readyState !== 1) {
    return 0;
  }

  const settingKey = ADMIN_ALERT_SETTING[type];

  if (settingKey) {
    const settingValue: unknown = await getSetting(settingKey);

    if (settingValue === false) {
      return 0;
    }
  }

  const admins = await UserModel.find({
    role: "admin",
    status: "active",
  })
    .select("_id")
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

  /**
   * Lists notifications for a user, optionally filtering to unread items.
   */
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

    return rows.map((row) => toDto(row));
  }

  /**
   * Lists customer notifications and returns unread counts by group.
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

      Types.ObjectId.isValid(userId)
        ? NotificationModel.aggregate<{
            _id: string;
            total: number;
            unread: number;
          }>([
            {
              $match: {
                userId: new Types.ObjectId(userId),
              },
            },
            {
              $group: {
                _id: "$type",
                total: { $sum: 1 },
                unread: {
                  $sum: {
                    $cond: [
                      { $eq: ["$readAt", null] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const groups = Object.fromEntries(
      NOTIFICATION_GROUPS.map((group) => [
        group,
        { total: 0, unread: 0 },
      ]),
    ) as CustomerNotificationsResult["groups"];

    for (const row of byType) {
      const group = groupOf(row._id);
      groups[group].total += row.total;
      groups[group].unread += row.unread;
    }

    const unread = NOTIFICATION_GROUPS.reduce(
      (total, group) => total + groups[group].unread,
      0,
    );

    const items: CustomerNotificationDto[] = rows.map(
      (row) => ({
        ...toDto(row),
        group: groupOf(row.type),
      }),
    );

    return {
      items,
      unread,
      groups,
    };
  }

  /**
   * Marks one of the caller's notifications as read.
   * A notification belonging to another user is not accessible.
   */
  async markReadForCustomer(
    userId: string,
    id: string,
  ): Promise<CustomerNotificationDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        400,
        "Invalid notification id",
        "VALIDATION_ERROR",
      );
    }

    const notification = await NotificationModel.findOne({
      _id: id,
      userId,
    });

    if (!notification) {
      throw new HttpError(
        404,
        "Notification not found",
        "NOT_FOUND",
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

  /**
   * Marks all unread notifications belonging to the customer as read.
   */
  async markAllReadForCustomer(
    userId: string,
  ): Promise<number> {
    const result = await NotificationModel.updateMany(
      {
        userId,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      },
    );

    return result.modifiedCount;
  }

  /**
   * Deletes one notification belonging to the customer.
   */
  async deleteForCustomer(
    userId: string,
    id: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        400,
        "Invalid notification id",
        "VALIDATION_ERROR",
      );
    }

    const result = await NotificationModel.deleteOne({
      _id: id,
      userId,
    });

    if (result.deletedCount === 0) {
      throw new HttpError(
        404,
        "Notification not found",
        "NOT_FOUND",
      );
    }
  }

  /**
   * Deletes every notification belonging to the customer.
   */
  async deleteAllForCustomer(
    userId: string,
  ): Promise<number> {
    const result = await NotificationModel.deleteMany({
      userId,
    });

    return result.deletedCount;
  }

  /**
   * Returns the unread notification count for a user.
   */
  unreadCount(userId: string) {
    return NotificationModel.countDocuments({
      userId,
      readAt: null,
    });
  }

  /**
   * Marks one notification as read for a user.
   */
  async markRead(
    userId: string,
    id: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      return;
    }

    await NotificationModel.updateOne(
      {
        _id: id,
        userId,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      },
    );
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  async markAllRead(userId: string): Promise<void> {
    await NotificationModel.updateMany(
      {
        userId,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      },
    );
  }
}

export const notificationsService = new NotificationsService();
