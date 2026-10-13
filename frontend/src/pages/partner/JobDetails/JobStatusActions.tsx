import { updateBookingStatus } from "./jobDetails.api";
import type { JobDetails } from "./jobDetails.types";

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="jd-btn jd-inline-btn">
      {label}
    </button>
  );
}

export default function JobStatusActions({
  job,
  onChanged,
  onStale,
}: {
  job: JobDetails;
  onChanged: (value: JobDetails) => void;
  onStale?: () => void;
}) {
  const actions = job.actions ?? [];
  const handle = async (status: string) => {
    try {
      const updated = await updateBookingStatus(job.id, status, "Partner update");
      onChanged({
        ...job,
        status: updated.status,
        actions: updated.actions,
        otpRequired: updated.otpRequired,
        payment: { status: updated.payment.status, amount: updated.price.total },
      });
    } catch {
      onStale?.();
    }
  };

  if (!actions.length) return null;

  return (
    <div className="jd-actions" aria-label="Job status actions">
      {actions.map((action) => (
        <ActionButton
          key={action.status}
          label={action.label}
          onClick={() => void handle(action.status)}
        />
      ))}
    </div>
  );
}
