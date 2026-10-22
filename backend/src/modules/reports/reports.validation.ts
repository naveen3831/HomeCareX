
import { Types } from 'mongoose';

import {
  REPORTS_CONSTANTS,
  REPORT_TYPES,
} from './reports.constants';

import type {
  ReportFilters,
  ReportsTypes,
} from './reports.types';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

function isValidDate(value: string): boolean {
  if (!REPORTS_CONSTANTS.DATE_REGEX.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum?: number,
): number {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return maximum
    ? Math.min(parsed, maximum)
    : parsed;
}

export const reportsValidation = {
  query(
    query: Record<string, unknown>,
  ): ValidationResult<ReportsTypes> {
    const errors: string[] = [];

    const reportType = String(query.type ?? '');

    if (
      !REPORT_TYPES.includes(
        reportType as (typeof REPORT_TYPES)[number],
      )
    ) {
      errors.push(
        'Invalid report type. Supported types: bookings, revenue, partners.',
      );
    }

    const from =
      query.from === undefined
        ? undefined
        : String(query.from);

    const to =
      query.to === undefined
        ? undefined
        : String(query.to);

    if (from && !isValidDate(from)) {
      errors.push(
        'from must be a valid date in YYYY-MM-DD format.',
      );
    }

    if (to && !isValidDate(to)) {
      errors.push(
        'to must be a valid date in YYYY-MM-DD format.',
      );
    }

    if (from && to && from > to) {
      errors.push(
        'from must be earlier than or equal to to.',
      );
    }

    for (const field of [
      'city',
      'category',
      'status',
      'partner',
    ] as const) {
      if (
        query[field] !== undefined &&
        (
          typeof query[field] !== 'string' ||
          String(query[field]).trim().length === 0
        )
      ) {
        errors.push(
          `${field} must be a non-empty string.`,
        );
      }
    }

    if (
      query.category &&
      !Types.ObjectId.isValid(String(query.category))
    ) {
      errors.push('category must be a valid ID.');
    }

    if (
      query.partner &&
      !Types.ObjectId.isValid(String(query.partner))
    ) {
      errors.push('partner must be a valid ID.');
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    return {
      success: true,
      data: {
        reportType:
          reportType as ReportsTypes['reportType'],

        from,
        to,

        city: query.city
          ? String(query.city).trim()
          : undefined,

        category: query.category
          ? String(query.category)
          : undefined,

        status: query.status
          ? String(query.status).trim()
          : undefined,

        partner: query.partner
          ? String(query.partner)
          : undefined,

        page: parsePositiveInteger(
          query.page,
          REPORTS_CONSTANTS.DEFAULT_PAGE,
        ),

        limit: parsePositiveInteger(
          query.limit,
          REPORTS_CONSTANTS.DEFAULT_LIMIT,
          REPORTS_CONSTANTS.MAX_LIMIT,
        ),
      },
    };
  },

  filters(input: ReportsTypes): ReportFilters {
    const from = input.from
      ? new Date(
          `${input.from}T00:00:00.000+05:30`,
        )
      : undefined;

    const toExclusive = input.to
      ? new Date(
          new Date(
            `${input.to}T00:00:00.000+05:30`,
          ).getTime() +
            24 * 60 * 60 * 1000,
        )
      : undefined;

    return {
      from,
      toExclusive,
      city: input.city,
      categoryId: input.category,
      status: input.status,
      partnerId: input.partner,
    };
  },
};
