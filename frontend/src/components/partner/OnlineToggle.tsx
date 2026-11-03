interface Props {
  online: boolean;
  onChange: (online: boolean) => void;
}

/**
 * Compact availability switch for the partner top bar.
 * Sits directly left of the notification bell on every partner page.
 */
export default function OnlineToggle({ online, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={online}
      aria-label={online ? "You are online. Switch to offline" : "You are offline. Switch to online"}
      onClick={() => onChange(!online)}
      className={`inline-flex h-9 items-center gap-2 rounded-full border pl-2.5 pr-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] ${
        online
          ? "border-orange-300 bg-orange-50 text-orange-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <span>{online ? "Online" : "Offline"}</span>
      <span
        aria-hidden="true"
        className={`relative inline-block h-5 w-9 rounded-full transition-colors ${
          online ? "bg-orange-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            online ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
