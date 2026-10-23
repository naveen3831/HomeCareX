import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CompletionChecklist from '@/components/partner/CompletionChecklist';
import * as apiModule from '@/pages/partner/JobDetails/jobDetails.api';
import type { ExtraChargeItem, JobDetails } from '@/pages/partner/JobDetails/jobDetails.types';

describe('CompletionChecklist Component', () => {
  const baseJob: JobDetails = {
    id: 'BK-20418',
    bookingCode: '#BK-20418',
    status: 'in_progress',
    customer: { name: 'Rohan K.', phoneMasked: '+91 ••••• ••214' },
    service: { name: 'Deep home cleaning', quantity: 1, durationMinutes: 180 },
    location: { address: 'Flat 402, Green Meadows', city: 'Hyderabad', pincode: '500039' },
    schedule: {
      scheduledAt: '2026-10-14T04:30:00.000Z',
      dateLabel: 'Tue, 14 Oct 2026',
      slot: '10:00 – 13:00',
      startedAt: '2026-10-14T04:32:00.000Z',
      completedAt: null,
    },
    price: { total: 1997, partnerEarning: 1498 },
    addOns: [],
    instructions: null,
    checklist: [
      { id: 'c1', label: 'Dust and wipe all surfaces', done: true },
      { id: 'c2', label: 'Scrub kitchen sink', done: true },
    ],
    payment: { status: 'PENDING', amount: 1997 },
    actions: [],
    otpRequired: true,
    history: [],
  };

  let completeJobSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    completeJobSpy = vi.spyOn(apiModule, 'completeJob');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal when isOpen is true', () => {
    render(
      <CompletionChecklist
        job={baseJob}
        isOpen={true}
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/job completion/i)).toBeInTheDocument();
    expect(screen.getByText(/all checklist items completed/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. extra charges status/i)).toBeInTheDocument();
    expect(screen.getByText(/no extra charges requested for this job/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete job/i })).toBeDisabled();
  });

  it('blocks completion when mandatory checklist items are incomplete', () => {
    const jobWithIncompleteChecklist: JobDetails = {
      ...baseJob,
      checklist: [
        { id: 'c1', label: 'Dust all surfaces', done: true },
        { id: 'c2', label: 'Clean kitchen exhaust', done: false },
      ],
    };

    render(
      <CompletionChecklist
        job={jobWithIncompleteChecklist}
        isOpen={true}
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    expect(screen.getByText(/incomplete mandatory items/i)).toBeInTheDocument();
    expect(screen.getByText('Clean kitchen exhaust')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete job/i })).toBeDisabled();
  });

  it('blocks completion when there are pending extra charges and shows pending customer approval', () => {
    const extraCharges: ExtraChargeItem[] = [
      {
        id: 'ec-1',
        title: 'Balcony pressure wash',
        quantity: 1,
        amount: 300,
        status: 'pending',
      },
    ];

    render(
      <CompletionChecklist
        job={baseJob}
        extraCharges={extraCharges}
        isOpen={true}
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    expect(screen.getByText(/2\. extra charges status/i)).toBeInTheDocument();
    expect(screen.getByText(/pending customer approval/i)).toBeInTheDocument();
    expect(screen.getByText(/balcony pressure wash/i)).toBeInTheDocument();
    expect(screen.getByText(/1 pending/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete job/i })).toBeDisabled();
  });

  it('allows completion when extra charges are already approved or rejected', () => {
    const extraCharges: ExtraChargeItem[] = [
      {
        id: 'ec-1',
        title: 'Extra filter',
        quantity: 1,
        amount: 250,
        status: 'approved',
      },
      {
        id: 'ec-2',
        title: 'Painting touch-up',
        quantity: 1,
        amount: 500,
        status: 'rejected',
      },
    ];

    render(
      <CompletionChecklist
        job={baseJob}
        extraCharges={extraCharges}
        isOpen={true}
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    expect(screen.getByText(/all extra charges have been decided/i)).toBeInTheDocument();
    expect(screen.queryByText(/pending customer approval/i)).not.toBeInTheDocument();
  });

  it('prevents completion submission for an already completed job', () => {
    const completedJob: JobDetails = {
      ...baseJob,
      status: 'completed',
    };

    render(
      <CompletionChecklist
        job={completedJob}
        isOpen={true}
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    expect(screen.getByText(/this job is already completed\. it cannot be completed again\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete job/i })).toBeDisabled();
  });

  it('submits successfully when all criteria are satisfied', async () => {
    const handleCompleted = vi.fn();
    const handleClose = vi.fn();
    const updatedJob: JobDetails = {
      ...baseJob,
      status: 'completed',
      schedule: { ...baseJob.schedule, completedAt: new Date().toISOString() },
    };

    completeJobSpy.mockResolvedValueOnce(updatedJob);

    render(
      <CompletionChecklist
        job={baseJob}
        isOpen={true}
        onClose={handleClose}
        onCompleted={handleCompleted}
      />,
    );

    // Confirm checkbox
    const confirmCheckbox = screen.getByLabelText(/i confirm that all tasks/i);
    fireEvent.click(confirmCheckbox);

    // Submit button should now be enabled
    const completeBtn = screen.getByRole('button', { name: /complete job/i });
    expect(completeBtn).toBeEnabled();

    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(completeJobSpy).toHaveBeenCalledWith(baseJob.id, { notes: undefined });
      expect(handleCompleted).toHaveBeenCalledWith(updatedJob);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays error when completeJob API fails', async () => {
    completeJobSpy.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: 'Could not complete the job at this time.' },
      },
    });

    render(
      <CompletionChecklist
        job={baseJob}
        isOpen={true}
        onClose={vi.fn()}
        onCompleted={vi.fn()}
      />,
    );

    // Confirm checkbox
    fireEvent.click(screen.getByLabelText(/i confirm that all tasks/i));

    const completeBtn = screen.getByRole('button', { name: /complete job/i });
    expect(completeBtn).toBeEnabled();
    fireEvent.click(completeBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not complete the job at this time/i);
  });
});
