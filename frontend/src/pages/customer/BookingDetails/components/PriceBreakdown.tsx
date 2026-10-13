import { Tag } from "lucide-react";
import { rupees } from "../../Bookings/bookingModel";
import type { PriceBreakdownModel } from "../bookingDetailModel";

export default function PriceBreakdown({
  model,
}: {
  model: PriceBreakdownModel;
}) {
  const visibleRows = model.rows.filter(
    (row) => row.key !== "discount" && row.key !== "gst",
  );

  if (model.rows.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          Price details aren't available for this booking yet.
        </p>
        <Total model={model} />
      </div>
    );
  }

  return (
    <dl className="space-y-3.5 text-sm">
      {/* Standard Line Items */}
      {visibleRows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3">
          <dt className="min-w-0 break-words text-muted">{row.label}</dt>
          <dd className="shrink-0 tabular-nums text-ink">
            {rupees(row.amount)}
          </dd>
        </div>
      ))}

      {/* GST is always listed so the customer can see what tax was charged. */}
      <div className="flex items-center justify-between gap-3">
        <dt className="min-w-0 break-words text-muted">GST</dt>
        <dd className="shrink-0 tabular-nums text-ink">
          {model.gst > 0 ? rupees(model.gst) : "Included"}
        </dd>
      </div>

      {/* Coupon: the code and the amount it saved, or a plain "none". */}
      <div className="flex items-center justify-between gap-3">
        <dt className="min-w-0 text-muted">Coupon</dt>
        {model.discount > 0 ? (
          <dd className="flex shrink-0 items-center gap-2 tabular-nums font-medium text-emerald-600">
            {model.couponCode && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase text-emerald-700">
                <Tag className="h-3 w-3" aria-hidden="true" />
                {model.couponCode}
              </span>
            )}
            <span>− {rupees(model.discount)}</span>
          </dd>
        ) : (
          <dd className="shrink-0 text-muted">None applied</dd>
        )}
      </div>

      {model.extraApproved > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
            <dt className="text-muted">Booking total</dt>
            <dd className="tabular-nums text-ink">{rupees(model.total)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Approved extra charges</dt>
            <dd className="tabular-nums text-ink">
              {rupees(model.extraApproved)}
            </dd>
          </div>
        </>
      )}

      <div className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-brand-soft px-4 py-3 text-lg font-bold text-ink">
        <dt>
          {model.extraApproved > 0 ? "Total with extras" : "Total Amount"}
        </dt>
        <dd className="tabular-nums">{rupees(model.grandTotal)}</dd>
      </div>
    </dl>
  );
}

function Total({ model }: { model: PriceBreakdownModel }) {
  return (
    <dl>
      <div className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-brand-soft px-4 py-3 text-lg font-bold text-ink">
        <dt>Total Amount</dt>
        <dd className="tabular-nums">{rupees(model.grandTotal)}</dd>
      </div>
    </dl>
  );
}
