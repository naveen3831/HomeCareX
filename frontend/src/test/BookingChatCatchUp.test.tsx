import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const fetchMessages = vi.fn();
const fakeSocket = {
  connected: false,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  timeout: () => ({ emit: vi.fn() }),
};

vi.mock('@/services/bookingSocket', () => ({
  getSocket: () => fakeSocket,
  joinBookingRoom: vi.fn().mockResolvedValue(false),
  leaveBookingRoom: vi.fn(),
}));
vi.mock('@/services/Chat.api', () => ({
  fetchMessages: (...a: unknown[]) => fetchMessages(...a),
  postMessage: vi.fn(),
  httpStatus: () => null,
  errorMessage: (_e: unknown, f: string) => f,
}));

import { useBookingChat } from '@/hooks/useBookingChat';

const msg = (id: string, text: string) => ({ id, bookingId: 'b1', text, photos: [], createdAt: '2026-10-30T07:00:00.000Z' });

describe('useBookingChat catch-up', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMessages.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a message the socket missed, without a reload', async () => {
    fetchMessages.mockResolvedValueOnce({ messages: [msg('1', 'hi')], nextCursor: null });
    const { result } = renderHook(() => useBookingChat('b1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.messages).toHaveLength(1);

    // Socket is not live, and a new customer message exists only on the server.
    fetchMessages.mockResolvedValue({ messages: [msg('1', 'hi'), msg('2', 'are you coming?')], nextCursor: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4100);
    });
    expect(result.current.messages.map((m: { id: string }) => m.id)).toEqual(['1', '2']);
  });
});