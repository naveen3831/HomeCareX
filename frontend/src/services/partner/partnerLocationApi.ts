import { bookingCode } from "@/pages/partner/JobDetails/jobDetails.mapper";
import { STATUS_LABEL } from "@/pages/partner/JobDetails/jobStatus";
import type { ApiJob } from "@/pages/partner/JobDetails/jobDetails.types";

export function mapJobToNavigation(job: ApiJob) {
  const customerAddress = [
    job.location.line1,
    job.location.area,
    job.location.city,
    job.location.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    customerName: job.customer.name,
    customerAddress,
    customerLocation: job.location.coordinates
      ? { lat: job.location.coordinates.lat, lng: job.location.coordinates.lng }
      : null,
    statusLabel: STATUS_LABEL[job.status] ?? job.status,
    jobCode: bookingCode(job.id),
  };
}
