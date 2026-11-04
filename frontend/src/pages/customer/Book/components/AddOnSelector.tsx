import { Check, Sparkles } from "lucide-react";
import clsx from "clsx";
import { formatINR } from "../formatMoney";
import type { ServiceAddOn } from "@/types/catalog";

interface AddOnSelectorProps {
  addOns: ServiceAddOn[];
  selectedIds: ReadonlySet<string>;
  onToggle: (addOn: ServiceAddOn) => void;
}

/** Add-ons as tappable cards matching reference design. */
export default function AddOnSelector({ addOns, selectedIds, onToggle }: AddOnSelectorProps) {
  if (addOns.length === 0) return null;

  return (
    <section aria-labelledby="addons-heading" className="space-y-3.5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4F46E5] shadow-xs">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 id="addons-heading" className="text-base font-bold text-slate-900">
              Additional Services
            </h3>
            {selectedIds.size > 0 && (
              <span role="status" className="text-xs font-semibold text-[#4F46E5]">
                {selectedIds.size} selected
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">Optional extras for this visit.</p>
        </div>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {addOns.map((addon) => {
          const checked = selectedIds.has(addon.id);
          return (
            <li key={addon.id}>
              <label
                className={clsx(
                  "relative flex min-h-[56px] cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all duration-200 select-none",
                  checked
                    ? "border-[#4F46E5] bg-[#F6F7FE] shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={checked}
                    onChange={() => onToggle(addon)}
                  />
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-200",
                      checked ? "border-[#4F46E5] bg-[#4F46E5] text-white" : "border-slate-300 bg-white text-transparent",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                  </span>
                  <span className={clsx("min-w-0 text-sm font-semibold", checked ? "text-slate-900" : "text-slate-800")}>
                    {addon.name}
                  </span>
                </div>
                <span
                  className={clsx(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-bold tabular-nums transition-colors",
                    checked ? "bg-[#4F46E5] text-white" : "bg-[#F3F4FE] text-[#4F46E5]",
                  )}
                >
                  +{formatINR(addon.price)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
