import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TOPICS,
  type NotificationChannel,
  type NotificationMatrix,
  type NotificationTopic,
} from "@/features/customer";

const TOPIC_LABEL: Record<NotificationTopic, { title: string; hint: string }> = {
  booking: { title: "Bookings", hint: "Confirmations, partner on the way, completion" },
  payment: { title: "Payments", hint: "Receipts, refunds, wallet activity" },
  offers: { title: "Offers", hint: "Discounts and new services" },
  reminders: { title: "Reminders", hint: "Upcoming visits and pending actions" },
  support: { title: "Support", hint: "Replies to your tickets" },
};
const CHANNEL_LABEL: Record<NotificationChannel, string> = { push: "Push", sms: "SMS", email: "Email", inApp: "In-app" };

const ROW = "md:grid md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] md:items-center";

interface Props {
  value: NotificationMatrix;
  onChange: (topic: NotificationTopic, channel: NotificationChannel, on: boolean) => void;
  disabled?: boolean;
}

/**
 * Topics (rows) × channels (columns). On a phone each topic is a small card with a 2×2 grid of switches, so
 * nothing scrolls sideways; from md up the column headings appear and the labels hide visually (still read aloud).
 */
export default function PreferencesMatrix({ value, onChange, disabled }: Props) {
  return (
    <div role="group" aria-label="Notification preferences" className="space-y-3">
      <div className={clsx(ROW, "hidden px-1 text-xs font-semibold uppercase tracking-wide text-muted md:grid")} aria-hidden="true">
        <span>Notify me about</span>
        {NOTIFICATION_CHANNELS.map((c) => (
          <span key={c} className="text-center">
            {CHANNEL_LABEL[c]}
          </span>
        ))}
      </div>

      {NOTIFICATION_TOPICS.map((topic) => (
        <fieldset key={topic} disabled={disabled} className={clsx(ROW, "min-w-0 ", "rounded-2xl border border-line/70 bg-canvas/60 p-3 md:rounded-xl md:border-0 md:bg-transparent md:p-1 md:py-2 md:even:bg-canvas/60")}>
          <legend className="sr-only">{TOPIC_LABEL[topic].title}</legend>
          <div className="mb-2 md:mb-0 md:pl-1" aria-hidden="true">
            <p className="text-sm font-semibold text-ink">{TOPIC_LABEL[topic].title}</p>
            <p className="text-xs text-muted">{TOPIC_LABEL[topic].hint}</p>
          </div>
          {NOTIFICATION_CHANNELS.map((channel) => {
            const id = `pref-${topic}-${channel}`;
            return (
              <label
                key={channel}
                htmlFor={id}
                className={clsx(
                  "inline-flex min-h-[44px] cursor-pointer items-center gap-2 md:justify-center",
                  "w-1/2 md:w-auto align-top",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  id={id}
                  type="checkbox"
                  aria-label={`${CHANNEL_LABEL[channel]} for ${TOPIC_LABEL[topic].title}`}
                  checked={value[topic][channel]}
                  onChange={(e) => onChange(topic, channel, e.target.checked)}
                  className={clsx("h-5 w-5 shrink-0 rounded border-line accent-brand", FOCUS_RING)}
                />
                <span className="text-sm text-ink md:sr-only" aria-hidden="true">
                  {CHANNEL_LABEL[channel]}
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
