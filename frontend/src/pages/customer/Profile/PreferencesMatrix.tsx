import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TOPICS,
  type NotificationChannel,
  type NotificationMatrix,
  type NotificationTopic,
} from "@/features/customer";

export const TOPIC_LABEL: Record<NotificationTopic, { title: string; hint: string }> = {
  booking: { title: "Bookings", hint: "Confirmations, partner on the way, completion" },
  payment: { title: "Payments", hint: "Receipts, refunds, wallet activity" },
  offers: { title: "Offers", hint: "Discounts and new services" },
  reminders: { title: "Reminders", hint: "Upcoming visits and pending actions" },
  support: { title: "Support", hint: "Replies to your tickets" },
};
const CHANNEL_LABEL: Record<NotificationChannel, string> = { push: "Push", sms: "SMS", email: "Email", inApp: "In-app" };
const CHANNEL_HINT: Record<NotificationChannel, string> = {
  push: "Instant alerts on your phone",
  sms: "Text messages to your mobile",
  email: "Receipts and summaries",
  inApp: "The bell at the top of the app",
};

interface Props {
  value: NotificationMatrix;
  onChange: (topic: NotificationTopic, channel: NotificationChannel, on: boolean) => void;
  /** The section whose options are open, or null while the list of sections is showing. */
  selected: NotificationTopic | null;
  onSelect: (topic: NotificationTopic | null) => void;
  disabled?: boolean;
}

/** "Push, Email" for the channels that are on, "Off" when none are. */
const summary = (v: NotificationMatrix, topic: NotificationTopic) => {
  const on = NOTIFICATION_CHANNELS.filter((c) => v[topic][c]).map((c) => CHANNEL_LABEL[c]);
  return on.length ? on.join(", ") : "Off";
};

/**
 * Two steps. First the section names (Bookings, Payments, …) with what each currently sends; choosing one opens
 * its options: Push, SMS, Email and In-app, each with a round radio-style marker. A channel can be on or off
 * independently, so several can be chosen for the same section. No card sits behind either step.
 */
export default function PreferencesMatrix({ value, onChange, selected, onSelect, disabled }: Props) {
  if (selected === null) {
    return (
      <div role="group" aria-label="Notification preferences">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Notify me about</h2>
        <ul className="divide-y divide-line/70 border-y border-line/70">
          {NOTIFICATION_TOPICS.map((topic) => {
            const state = summary(value, topic);
            return (
              <li key={topic}>
                <button
                  type="button"
                  onClick={() => onSelect(topic)}
                  disabled={disabled}
                  className={clsx("group flex min-h-[64px] w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-canvas disabled:opacity-60", FOCUS_RING)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{TOPIC_LABEL[topic].title}</span>
                    <span className="block text-xs text-muted">{TOPIC_LABEL[topic].hint}</span>
                  </span>
                  <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", state === "Off" ? "bg-canvas text-muted" : "bg-brand-soft text-brand")}>{state}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const { title, hint } = TOPIC_LABEL[selected];
  return (
    <fieldset disabled={disabled} className="min-w-0" aria-label="Notification preferences">
      <legend className="sr-only">{title}</legend>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={clsx("mb-4 inline-flex min-h-[40px] items-center gap-1 rounded-full pr-3 text-sm font-semibold text-brand hover:underline", FOCUS_RING)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        All sections
      </button>
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="mb-3 text-sm text-muted">{hint}</p>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Send me updates by</p>

      <ul className="divide-y divide-line/70 border-y border-line/70">
        {NOTIFICATION_CHANNELS.map((channel) => {
          const id = `pref-${selected}-${channel}`;
          return (
            <li key={channel}>
              <label htmlFor={id} className={clsx("flex min-h-[64px] cursor-pointer items-center gap-3 px-1 py-3", disabled && "cursor-not-allowed opacity-60")}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{CHANNEL_LABEL[channel]}</span>
                  <span className="block text-xs text-muted">{CHANNEL_HINT[channel]}</span>
                </span>
                {/* Real checkbox underneath (keyboard + screen reader), drawn as a round radio marker. */}
                <input
                  id={id}
                  type="checkbox"
                  aria-label={`${CHANNEL_LABEL[channel]} for ${title}`}
                  checked={value[selected][channel]}
                  onChange={(e) => onChange(selected, channel, e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line bg-panel transition-colors peer-checked:border-brand peer-checked:[&>span]:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2"
                >
                  <span className="h-3 w-3 scale-0 rounded-full bg-brand transition-transform" />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
