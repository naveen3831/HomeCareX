import { describe, expect, it } from 'vitest';
import { notificationMeta, notificationTarget } from '@/lib/adminNotificationMeta';
import { isSos } from '@/services/adminNotificationApi';

const target = (type: string, payload: Record<string, unknown> | null = {}) => notificationTarget({ type, payload });

describe('admin notification deep links', () => {
  it('opens the record each live alert is about', () => {
    expect(target('kyc.submitted', { partnerId: 'p1' })).toBe('/admin/partners/p1');
    expect(target('refund.requested', { refundId: 'r1' })).toBe('/admin/refunds/r1');
    expect(target('payout.failed', { payoutId: 'po1' })).toBe('/admin/payouts/po1');
    expect(target('sla.breach', { ticketId: 't1' })).toBe('/admin/support/t1');
    expect(target('sos.alert', { bookingId: 'b1' })).toBe('/admin/bookings?booking=b1');
  });

  it('falls back to the list page of that area when the id is missing', () => {
    expect(target('kyc.submitted')).toBe('/admin/partners');
    expect(target('refund.requested', null)).toBe('/admin/refunds');
    expect(target('payout.failed')).toBe('/admin/payouts');
    expect(target('sla.breach')).toBe('/admin/support');
  });

  it('SOS with no booking goes to the partner, then to the notifications page', () => {
    expect(target('sos.alert', { partnerId: 'p9' })).toBe('/admin/partners/p9');
    expect(target('sos.alert')).toBe('/admin/notifications');
  });

  it('never links to demo ids, and unknown types stay inside the app', () => {
    expect(target('sos.alert', { bookingId: 'demo-booking-1' })).toBe('/admin/notifications');
    expect(target('something.new', { whatever: 1 })).toBe('/admin/notifications');
  });

  it('encodes ids so a payload can never change the path', () => {
    expect(target('refund.requested', { refundId: '../../evil?x=1' })).toBe('/admin/refunds/..%2F..%2Fevil%3Fx%3D1');
    expect(target('kyc.submitted', { partnerId: 42 })).toBe('/admin/partners'); // not a string: ignored
  });
});

describe('admin notification look', () => {
  it('has a title for every live type and a readable one for unknown types', () => {
    expect(notificationMeta('kyc.submitted').title).toBe('KYC submitted');
    expect(notificationMeta('refund.requested').title).toBe('Refund requested');
    expect(notificationMeta('payout.failed').title).toBe('Payout failed');
    expect(notificationMeta('sla.breach').title).toBe('SLA breach');
    expect(notificationMeta('partner:sos').title).toBe('SOS alert');
    expect(notificationMeta('brand.new_type').title).toBe('Brand new type');
  });

  it('treats sos.alert and partner:sos as SOS, nothing else', () => {
    expect(isSos({ type: 'sos.alert' })).toBe(true);
    expect(isSos({ type: 'partner:sos' })).toBe(true);
    expect(isSos({ type: 'payout.failed' })).toBe(false);
  });
});
