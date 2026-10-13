/** Real bookings use MongoDB ObjectIds. Demo / simulated jobs use ids like "job-booking-123-partner-1". */
export const isBookingId = (id: string): boolean => /^[a-f\d]{24}$/i.test(id);
