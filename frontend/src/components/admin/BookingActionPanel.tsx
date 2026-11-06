import React, { useEffect } from "react";
import { useSidebarOffset } from "@/hooks/useSidebarOffset";
import "./BookingActionPanel.css";

interface BookingActionPanelProps {
  title: string;
  subtitle?: React.ReactNode;
  titleId: string;
  onClose: () => void;
  closeDisabled?: boolean;
  closeLabel?: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared full-page shell for Assign Partner, Override Status and
 * Cancel Booking. It starts after the admin sidebar, like the
 * booking details page, and uses the Bookings page design tokens.
 */
export const BookingActionPanel: React.FC<
  BookingActionPanelProps
> = ({
  title,
  subtitle,
  titleId,
  onClose,
  closeDisabled = false,
  closeLabel = "Close",
  footer,
  children,
}) => {
  const sidebarWidth = useSidebarOffset();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) {
        // Stop the booking details page behind this panel from also closing.
        event.stopImmediatePropagation();
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape, true);

    return () => {
      document.removeEventListener("keydown", handleEscape, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, closeDisabled]);

  return (
    <div
      className="bk-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={
        {
          "--bk-panel-left": `${sidebarWidth}px`,
        } as React.CSSProperties
      }
    >
      <header className="bk-panel__header">
        <div className="bk-panel__header-inner">
          <div>
            <h1 id={titleId} className="bk-panel__title">
              {title}
            </h1>
            {subtitle ? (
              <p className="bk-panel__subtitle">{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            className="bk-panel__close"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>
      </header>

      <div className="bk-panel__body">
        <div className="bk-panel__content">{children}</div>
      </div>

      <footer className="bk-panel__footer">
        <div className="bk-panel__footer-inner">{footer}</div>
      </footer>
    </div>
  );
};

export default BookingActionPanel;