
import { AuditLogQuery, CreateAuditLogInput } from './audit.types';
import { AUDIT_CONSTANTS } from './audit.constants';

export class AuditQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditQueryValidationError';
  }
}

/**
 * Validates audit-log data before creating a record.
 */
export const validateCreateAuditLog = (
  input: CreateAuditLogInput
): string | null => {
  if (!input.actor?.trim()) {
    return 'actor is required';
  }

  if (!input.action?.trim()) {
    return 'action is required';
  }

  if (!input.entity?.trim()) {
    return 'entity is required';
  }

  if (!input.entityId?.trim()) {
    return 'entityId is required';
  }

  if (!input.ip?.trim()) {
    return 'ip is required';
  }

  if (!['Success', 'Failed'].includes(input.result)) {
    return 'result must be Success or Failed';
  }

  return null;
};

/**
 * Reads an optional non-empty string query parameter.
 */
const optionalString = (
  query: Record<string, unknown>,
  key: string
): string | undefined => {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new AuditQueryValidationError(
      `${key} must be a non-empty string`
    );
  }

  return value.trim();
};

/**
 * Validates an optional date query parameter.
 */
const optionalDate = (
  query: Record<string, unknown>,
  key: string
): string | undefined => {
  const value = optionalString(query, key);

  if (value === undefined) {
    return undefined;
  }

  // Accept ISO-style date or datetime strings only.
  const isValidFormat =
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(
      value
    );

  if (!isValidFormat || Number.isNaN(Date.parse(value))) {
    throw new AuditQueryValidationError(
      `${key} must be a valid ISO date or datetime`
    );
  }

  return value;
};

/**
 * Validates integer query parameters and applies defaults.
 */
const integerParam = (
  query: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number
): number => {
  const value = query[key];

  if (value === undefined) {
    return fallback;
  }

  if (
    typeof value !== 'string' ||
    !/^\d+$/.test(value)
  ) {
    throw new AuditQueryValidationError(
      `${key} must be an integer`
    );
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new AuditQueryValidationError(
      `${key} must be between ${min} and ${max}`
    );
  }

  return parsed;
};

/**
 * Parses and validates audit-log search filters and pagination.
 */
export const parseAuditQuery = (
  query: Record<string, unknown>
): AuditLogQuery => {
  const actor = optionalString(query, 'actor');
  const action = optionalString(query, 'action');
  const entity = optionalString(query, 'entity');
  const entityId = optionalString(query, 'entityId');

  const from = optionalDate(query, 'from');
  const to = optionalDate(query, 'to');

  if (
    from &&
    to &&
    new Date(from).getTime() > new Date(to).getTime()
  ) {
    throw new AuditQueryValidationError(
      'from must be earlier than or equal to to'
    );
  }

  const page = integerParam(
    query,
    'page',
    AUDIT_CONSTANTS.DEFAULT_PAGE,
    1,
    Number.MAX_SAFE_INTEGER
  );

  const limit = integerParam(
    query,
    'limit',
    AUDIT_CONSTANTS.DEFAULT_LIMIT,
    1,
    AUDIT_CONSTANTS.MAX_LIMIT
  );

  return {
    actor,
    action,
    entity,
    entityId,
    from,
    to,
    page,
    limit,
  };
};
