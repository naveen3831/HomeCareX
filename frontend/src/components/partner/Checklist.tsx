import React, { useEffect, useState } from 'react';
import { persistChecklistItem, getErrorMessage } from '@/pages/partner/JobDetails/jobDetails.api';
import type { JobChecklistItem } from '@/pages/partner/JobDetails/jobDetails.types';

export interface ChecklistProps {
  jobId: string;
  items: JobChecklistItem[];
  readOnly?: boolean;
  onItemsUpdated?: (items: JobChecklistItem[]) => void;
  className?: string;
}

export const Checklist: React.FC<ChecklistProps> = ({
  jobId,
  items,
  readOnly = false,
  onItemsUpdated,
  className = '',
}) => {
  const [localItems, setLocalItems] = useState<JobChecklistItem[]>(items);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  // Sync if parent updates (e.g. fresh fetch from backend on refresh)
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const handleToggle = async (item: JobChecklistItem) => {
    if (readOnly || pendingIds.has(item.id)) return;

    if (!navigator.onLine) {
      setErrorMap((prev) => ({
        ...prev,
        [item.id]: 'You are offline. Cannot save checklist changes.',
      }));
      return;
    }

    const nextDone = !item.done;

    // Track pending
    setPendingIds((prev) => new Set(prev).add(item.id));
    setErrorMap((prev) => {
      const copy = { ...prev };
      delete copy[item.id];
      return copy;
    });

    try {
      const updatedBackend = await persistChecklistItem(jobId, item.id, nextDone);

      // Successfully saved!
      let nextItems: JobChecklistItem[];
      if (updatedBackend && updatedBackend.length > 0) {
        nextItems = updatedBackend;
      } else {
        nextItems = localItems.map((it) => (it.id === item.id ? { ...it, done: nextDone } : it));
      }
      setLocalItems(nextItems);
      onItemsUpdated?.(nextItems);
    } catch (err) {
      // Revert & show error: do not falsely indicate change was persisted!
      setErrorMap((prev) => ({
        ...prev,
        [item.id]: getErrorMessage(err, 'Could not save item completion. Try again.'),
      }));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  if (localItems.length === 0) {
    return (
      <div className={`checklist-empty rounded border border-dashed border-line p-4 text-center ${className}`}>
        <p className="text-sm text-muted">No checklist items for this service.</p>
      </div>
    );
  }

  const completedCount = localItems.filter((i) => i.done).length;

  return (
    <div className={`checklist-container ${className}`}>
      <div className="sr-only">
        <span>
          Progress: {completedCount} / {localItems.length} completed
        </span>
      </div>

      <ul className="checklist-items space-y-2.5" aria-label="Service task checklist">
        {localItems.map((item) => {
          const isPending = pendingIds.has(item.id);
          const hasError = Boolean(errorMap[item.id]);
          const inputId = `checklist-item-${item.id}`;

          return (
            <li
              key={item.id}
              className={`checklist-row flex flex-col py-1 transition-opacity ${
                isPending ? 'opacity-70' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={item.done}
                  disabled={readOnly || isPending}
                  onChange={() => void handleToggle(item)}
                  className="h-4 w-4 rounded border-slate-300 text-[#4338ca] accent-[#4338ca] focus:ring-[#4338ca] focus:ring-2 focus:ring-offset-1 cursor-pointer disabled:cursor-not-allowed"
                  aria-describedby={hasError ? `error-${item.id}` : undefined}
                />
                <label
                  htmlFor={inputId}
                  className="text-[13.5px] select-none cursor-pointer flex-1 text-slate-700 font-normal leading-snug"
                >
                  {item.label}
                </label>
                {isPending && (
                  <span className="text-xs text-[#4338ca] animate-pulse" aria-live="polite">
                    Saving…
                  </span>
                )}
              </div>

              {hasError && (
                <p id={`error-${item.id}`} className="mt-1.5 text-xs text-red-600 pl-8" role="alert">
                  {errorMap[item.id]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Checklist;
