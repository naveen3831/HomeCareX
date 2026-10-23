// export class AuditRepository {}

import mongoose from "mongoose";
import AuditLogModel from "../../models/AuditLog";
import UserModel from "../../models/User";
import {
  AuditLogQuery,
  CreateAuditLogInput,
} from "./audit.types";

export class AuditRepository {
  async create(input: CreateAuditLogInput) {
    return AuditLogModel.create(input);
  }

  async findMany(query: AuditLogQuery) {
    const filter: Record<string, unknown> = {};

    if (query.actor) {
      filter.actor = query.actor;
    }

    if (query.action) {
      filter.action = query.action;
    }

    if (query.entity) {
      filter.entity = query.entity;
    }

    if (query.entityId) {
      filter.entityId = query.entityId;
    }

    if (query.from || query.to) {
      const timestampFilter: Record<string, Date> = {};

      if (query.from) {
        timestampFilter.$gte = new Date(query.from);
      }

      if (query.to) {
        timestampFilter.$lte = new Date(query.to);
      }

      filter.createdAt = timestampFilter;
    }

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      AuditLogModel.countDocuments(filter),
    ]);

    // The audit row stores the actor's user id. Look up their names in one query
    // so the admin UI can show "Asha Rao" instead of "6abb7fd4...". Ids that are
    // not users (e.g. "system") or were deleted simply have no name.
    const actorIds = [...new Set(items.map((item) => String(item.actor)))].filter(
      (id) => mongoose.isValidObjectId(id)
    );

    const users = actorIds.length
      ? await UserModel.find({ _id: { $in: actorIds } })
          .select("name")
          .lean()
      : [];

    const nameById = new Map(users.map((user) => [String(user._id), user.name]));

    return {
      items: items.map((item) => ({
        ...item,
        actorName: nameById.get(String(item.actor)) ?? null,
      })),
      total,
      page,
      limit,
    };
  }
}