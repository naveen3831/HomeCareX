import React, { useEffect, useState } from 'react';
import { persistChecklistItem, getErrorMessage } from '@/pages/partner/JobDetails/jobDetails.api';
import type { JobChecklistItem } from '@/pages/partner/JobDetails/jobDetails.types';
import './checklist.css';

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
      <div className={`checklist-empty ${className}`}>
        <p>No checklist items for this service.</p>
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

      <ul className="checklist-items" aria-label="Service task checklist">
        {localItems.map((item) => {
          const isPending = pendingIds.has(item.id);
          const hasError = Boolean(errorMap[item.id]);
          const inputId = `checklist-item-${item.id}`;

          return (
            <li
              key={item.id}
              className={`checklist-row ${item.done ? 'checklist-row-done' : ''} ${
                isPending ? 'opacity-70' : ''
              }`}
            >
              <div className="checklist-line">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={item.done}
                  disabled={readOnly || isPending}
                  onChange={() => void handleToggle(item)}
                  className="checklist-box"
                  aria-describedby={hasError ? `error-${item.id}` : undefined}
                />
                <label
                  htmlFor={inputId}
                  className="checklist-label"
                >
                  {item.label}
                </label>
                {isPending && (
                  <span className="checklist-saving" aria-live="polite">
                    Saving…
                  </span>
                )}
              </div>

              {hasError && (
                <p id={`error-${item.id}`} className="checklist-error" role="alert">
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
