import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExtraChargeForm from '@/components/partner/ExtraChargeForm';
import * as apiModule from '@/pages/partner/JobDetails/jobDetails.api';
import type { ExtraChargeItem } from '@/pages/partner/JobDetails/jobDetails.types';

describe('ExtraChargeForm Component', () => {
  const BOOKING_ID = 'BK-20418';
  let createExtraChargeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    createExtraChargeSpy = vi.spyOn(apiModule, 'createExtraCharge');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly when open', () => {
    render(<ExtraChargeForm bookingId={BOOKING_ID} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/item or extra-work description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantity/i)).toHaveValue(1);
    expect(screen.getByLabelText(/unit amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit for approval/i })).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ExtraChargeForm bookingId={BOOKING_ID} isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('validates description is required', async () => {
    render(<ExtraChargeForm bookingId={BOOKING_ID} isOpen={true} onClose={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /submit for approval/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(/item description is required/i);
    expect(createExtraChargeSpy).not.toHaveBeenCalled();
  });

  it('validates quantity must be a positive integer', async () => {
    const user = userEvent.setup();
    render(<ExtraChargeForm bookingId={BOOKING_ID} isOpen={true} onClose={vi.fn()} />);

    const descInput = screen.getByLabelText(/item or extra-work description/i);
    const qtyInput = screen.getByLabelText(/quantity/i);
    const amountInput = screen.getByLabelText(/unit amount/i);

    await user.type(descInput, 'Extra filter replacement');
    fireEvent.change(qtyInput, { target: { value: '0' } });
    await user.type(amountInput, '350');

    const submitBtn = screen.getByRole('button', { name: /submit for approval/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(/quantity must be a positive integer/i);
    expect(createExtraChargeSpy).not.toHaveBeenCalled();
  });

  it('validates amount must be a positive number', async () => {
    const user = userEvent.setup();
    render(<ExtraChargeForm bookingId={BOOKING_ID} isOpen={true} onClose={vi.fn()} />);

    const descInput = screen.getByLabelText(/item or extra-work description/i);
    const amountInput = screen.getByLabelText(/unit amount/i);

    await user.type(descInput, 'Extra filter replacement');
    fireEvent.change(amountInput, { target: { value: '-50' } });

    const submitBtn = screen.getByRole('button', { name: /submit for approval/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid positive monetary amount/i);
    expect(createExtraChargeSpy).not.toHaveBeenCalled();
  });

  it('submits successfully with valid data and calls onChargeCreated and onClose', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleCreated = vi.fn();

    const mockCreatedCharge: ExtraChargeItem = {
      id: 'ec-12345',
      title: 'Deep stain removal chemical',
      description: 'Deep stain removal chemical',
      quantity: 2,
      amount: 400,
      reason: 'Stubborn floor stains',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    createExtraChargeSpy.mockResolvedValueOnce(mockCreatedCharge);

    render(
      <ExtraChargeForm
        bookingId={BOOKING_ID}
        isOpen={true}
        onClose={handleClose}
        onChargeCreated={handleCreated}
      />,
    );

    await user.type(screen.getByLabelText(/item or extra-work description/i), 'Deep stain removal chemical');
    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), '2');
    await user.type(screen.getByLabelText(/unit amount/i), '400');
    await user.type(screen.getByLabelText(/reason/i), 'Stubborn floor stains');

    // Live estimated total check: 2 * 400 = 800
    expect(screen.getByText(/total extra charge to request: ₹800/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /submit for approval/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createExtraChargeSpy).toHaveBeenCalledWith(BOOKING_ID, {
        description: 'Deep stain removal chemical',
        quantity: 2,
        amount: 400,
        reason: 'Stubborn floor stains',
      });
      expect(handleCreated).toHaveBeenCalledWith(mockCreatedCharge);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays server error if the API request fails', async () => {
    const user = userEvent.setup();
    createExtraChargeSpy.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { message: 'Extra charges endpoint not implemented on backend.' },
      },
    });

    render(<ExtraChargeForm bookingId={BOOKING_ID} isOpen={true} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/item or extra-work description/i), 'Gas valve');
    await user.type(screen.getByLabelText(/unit amount/i), '200');

    fireEvent.click(screen.getByRole('button', { name: /submit for approval/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/extra charges endpoint not implemented on backend/i);
  });

  it('prevents duplicate submissions while in-flight', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: ExtraChargeItem) => void;
    const slowPromise = new Promise<ExtraChargeItem>((resolve) => {
      resolvePromise = resolve;
    });

    createExtraChargeSpy.mockReturnValueOnce(slowPromise);

    render(<ExtraChargeForm bookingId={BOOKING_ID} isOpen={true} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/item or extra-work description/i), 'Motor oil');
    await user.type(screen.getByLabelText(/unit amount/i), '150');

    const submitBtn = screen.getByRole('button', { name: /submit for approval/i });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(createExtraChargeSpy).toHaveBeenCalledTimes(1);

    resolvePromise!({
      id: 'ec-1',
      title: 'Motor oil',
      quantity: 1,
      amount: 150,
      status: 'pending',
    });
  });
});
