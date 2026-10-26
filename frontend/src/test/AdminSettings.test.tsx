import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SettingsSection } from '@/services/adminSettingsApi';

vi.mock('@/services/adminSettingsApi', async (orig) => ({
  ...(await orig<typeof import('@/services/adminSettingsApi')>()),
  fetchSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

import { fetchSettings, saveSettings, SettingsApiError } from '@/services/adminSettingsApi';
import AdminSettingsPage from '@/pages/admin/Settings';

const mFetch = vi.mocked(fetchSettings);
const mSave = vi.mocked(saveSettings);

const sections = (over: { gst?: number; commission?: number; bookingAlerts?: boolean } = {}): SettingsSection[] => [
  {
    id: 'business',
    label: 'Business',
    description: 'Name and address used across the platform.',
    settings: [
      { key: 'business.name', label: 'Business name', description: 'Public business name', type: 'string', value: 'HomeCareX', default: 'HomeCareX', maxLength: 80, updatedAt: null },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    description: 'Platform commission on completed jobs.',
    settings: [
      { key: 'commission.percent', label: 'Platform commission', description: 'Commission on completed jobs', type: 'number', value: over.commission ?? 20, default: 20, min: 0, max: 100, unit: '%', updatedAt: null },
    ],
  },
  {
    id: 'tax',
    label: 'Tax',
    description: 'Tax charged on bookings.',
    settings: [
      { key: 'tax.gstPercent', label: 'GST', description: 'GST percentage applied to bookings', type: 'number', value: over.gst ?? 18, default: 18, min: 0, max: 100, unit: '%', updatedAt: null },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Which events alert admins in the bell.',
    settings: [
      { key: 'notifications.adminBookingAlerts', label: 'New booking alerts', description: 'Notify admins when a booking is created', type: 'boolean', value: over.bookingAlerts ?? true, default: true, updatedAt: null },
    ],
  },
];

const tab = (name: string) => screen.getByRole('tab', { name });
const save = () => screen.getByRole('button', { name: /^save/i });
const cancel = () => screen.getByRole('button', { name: 'Cancel' });

// jsdom has no layout, so the tab strip's scrollIntoView doesn't exist there.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  mFetch.mockResolvedValue(sections());
});

describe('admin settings page', () => {
  it('shows one tab per section, and each setting with its label, description and allowed range', async () => {
    render(<AdminSettingsPage />);
    await screen.findByLabelText('Business name');
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Business', 'Pricing', 'Tax', 'Notifications']);
    expect(screen.getByText('Public business name')).toBeInTheDocument();

    await userEvent.click(tab('Tax'));
    expect(screen.getByLabelText('GST')).toHaveValue(18);
    expect(screen.getByText('GST percentage applied to bookings')).toBeInTheDocument();
    expect(screen.getByText('Allowed: 0 to 100 %')).toBeInTheDocument();
  });

  it('Save and Cancel stay disabled until something changes', async () => {
    render(<AdminSettingsPage />);
    await screen.findByLabelText('Business name');
    expect(save()).toBeDisabled();
    expect(cancel()).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Business name'), 'X');
    expect(save()).toBeEnabled();
    expect(cancel()).toBeEnabled();
  });

  it('rejects an out-of-range number on the spot and sends nothing', async () => {
    render(<AdminSettingsPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Tax' }));
    const gst = screen.getByLabelText('GST');
    await userEvent.clear(gst);
    await userEvent.type(gst, '150');
    await userEvent.click(save());
    expect(await screen.findByText('GST must be between 0 and 100 %')).toBeInTheDocument();
    expect(mSave).not.toHaveBeenCalled();
  });

  it('rejects a blank number', async () => {
    render(<AdminSettingsPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Tax' }));
    await userEvent.clear(screen.getByLabelText('GST'));
    await userEvent.click(save());
    expect(await screen.findByText('GST must be a number')).toBeInTheDocument();
    expect(mSave).not.toHaveBeenCalled();
  });

  it('saves only the changed setting of this section, then shows what the server returned', async () => {
    mSave.mockResolvedValueOnce(sections({ commission: 25 }));
    render(<AdminSettingsPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Pricing' }));
    const field = screen.getByLabelText('Platform commission');
    await userEvent.clear(field);
    await userEvent.type(field, '25');
    await userEvent.click(save());
    await waitFor(() => expect(mSave).toHaveBeenCalledWith({ 'commission.percent': 25 }));
    expect(await screen.findByText('Pricing settings saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Platform commission')).toHaveValue(25);
    expect(save()).toBeDisabled(); // nothing left to save
  });

  it('Cancel puts the saved value back and sends nothing', async () => {
    render(<AdminSettingsPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Tax' }));
    const gst = screen.getByLabelText('GST');
    await userEvent.clear(gst);
    await userEvent.type(gst, '12');
    await userEvent.click(cancel());
    expect(screen.getByLabelText('GST')).toHaveValue(18);
    expect(mSave).not.toHaveBeenCalled();
  });

  it('toggles a notification setting and saves the boolean', async () => {
    mSave.mockResolvedValueOnce(sections({ bookingAlerts: false }));
    render(<AdminSettingsPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Notifications' }));
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    await userEvent.click(save());
    await waitFor(() => expect(mSave).toHaveBeenCalledWith({ 'notifications.adminBookingAlerts': false }));
  });

  it("shows the server's message under the field that failed", async () => {
    mSave.mockRejectedValueOnce(new SettingsApiError('Some fields are invalid', 400, { 'business.name': 'Business name is required' }));
    render(<AdminSettingsPage />);
    const name = await screen.findByLabelText('Business name');
    await userEvent.type(name, '!');
    await userEvent.click(save());
    expect(await screen.findAllByText('Business name is required')).not.toHaveLength(0);
  });

  it('403 tells the admin which permission is missing', async () => {
    mSave.mockRejectedValueOnce(new SettingsApiError('Missing permission: settings:manage', 403));
    render(<AdminSettingsPage />);
    await userEvent.type(await screen.findByLabelText('Business name'), '!');
    await userEvent.click(save());
    expect(await screen.findByText('You need the settings:manage permission.')).toBeInTheDocument();
  });

  it('shows the error when settings cannot be loaded', async () => {
    mFetch.mockRejectedValueOnce(new SettingsApiError('Could not reach the server. Please check that the backend is running.'));
    render(<AdminSettingsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server');
  });
});
