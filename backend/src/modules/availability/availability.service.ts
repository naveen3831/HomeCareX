import * as repo from './availability.repository';
import { UpdateAvailabilityInput } from './availability.validation';
import Availability from './availability.model';
import * as blackoutRepo from './blackout.repository';

export class AvailabilityError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AvailabilityError';
  }
}

export interface Slot {
  date: string;  // YYYY-MM-DD
  start: string; // HH:mm, 24-hour
  end: string;   // HH:mm, 24-hour
}

// MOCK: Replace with actual onboarding verification when available.
const isOnboardingComplete = async (_partnerId: string): Promise<boolean> => true;

const JS_DAY_TO_NAME = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const isValidDate = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const parsed = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

const isValidTime = (time: string): boolean => {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
};

export const getAvailability = (partnerId: string) =>
  repo.findOrCreate(partnerId);

export const updateAvailability = async (
  partnerId: string,
  input: UpdateAvailabilityInput,
) => {
  if (
    input.isOnline === true &&
    !(await isOnboardingComplete(partnerId))
  ) {
    throw new AvailabilityError(
      403,
      'Complete onboarding before going online',
    );
  }

  await repo.findOrCreate(partnerId);

  return repo.update(partnerId, input);
};

export const isAvailable = async (
  partnerId: string,
  slot: Slot,
): Promise<boolean> => {
  if (
    !partnerId ||
    !isValidDate(slot.date) ||
    !isValidTime(slot.start) ||
    !isValidTime(slot.end) ||
    slot.start >= slot.end
  ) {
    return false;
  }

  const availability = await Availability.findOne({ partnerId })
    .lean()
    .exec();

  if (!availability || availability.isOnline !== true) {
    return false;
  }

  const blackedOut = await blackoutRepo.existOnDate(
    partnerId,
    slot.date,
  );

  if (blackedOut) return false;

  const dayIndex = new Date(
    `${slot.date}T00:00:00.000Z`,
  ).getUTCDay();

  const dayName = JS_DAY_TO_NAME[dayIndex];

  const day = availability.workingHours.find(
    (item) => item.day === dayName,
  );

  if (!day || day.off) return false;

  if (
    !isValidTime(day.start) ||
    !isValidTime(day.end) ||
    day.start >= day.end
  ) {
    return false;
  }

  return slot.start >= day.start && slot.end <= day.end;
};
