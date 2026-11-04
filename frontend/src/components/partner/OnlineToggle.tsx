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
      className={`relative inline-flex h-7 items-center gap-1.5 rounded-full border pl-2 pr-1 text-[11px] font-semibold before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] sm:h-9 sm:gap-2 sm:pl-2.5 sm:pr-1.5 sm:text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] ${
        online
          ? "border-orange-300 bg-orange-50 text-orange-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <span>{online ? "Online" : "Offline"}</span>
      <span
        aria-hidden="true"
        className={`relative inline-block h-4 w-7 rounded-full sm:h-5 sm:w-9 transition-colors ${
          online ? "bg-orange-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all sm:h-4 sm:w-4 ${
            online ? "left-[14px] sm:left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}