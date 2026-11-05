import { useEffect, useId, useState } from "react";
import { BadgeCheck, Clock3, Plus, RotateCcw, X } from "lucide-react";
import { classifyApiError } from "@/lib/apiError";
import { useLoad } from "../useLoad";
import { getPartnerSkills, requestPartnerSkill, type PartnerSkills } from "./skills.api";

const MAX_LEN = 60;

/**
 * "My skills": what the partner chose when joining, plus skills they ask to add later.
 * A new skill is only a request until an admin approves it.
 */
export default function MySkillsCard() {
  const { status, data, reload } = useLoad<PartnerSkills>(getPartnerSkills);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  useEffect(() => {
    if (!sent) return;
    const t = window.setTimeout(() => setSent(null), 4000);
    return () => window.clearTimeout(t);
  }, [sent]);

  const submit = async (skill: string) => {
    const clean = skill.replace(/\s+/g, " ").trim();
    if (clean.length < 2) { setError("Type the skill name (at least 2 letters)."); return; }
    setBusy(true);
    setError(null);
    try {
      await requestPartnerSkill(clean);
      setOpen(false);
      setName("");
      setSent(clean);
      reload();
    } catch (err) {
      setError(classifyApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" aria-hidden="true" />;
  // The skills card is extra: if it can't load, the services list below still works.
  if (status !== "ready" || !data) return null;

  const pending = data.requests.filter((r) => r.status === "pending");
  const rejected = data.requests.filter((r) => r.status === "rejected");

  return (
    <section className="rounded-2xl border border-slate-300/70 bg-white p-3 shadow-sm sm:p-4" aria-label="My skills">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">My skills</h2>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">Skills you chose when joining. New skills need admin approval.</p>
        </div>
        <button
          type="button"
          onClick={() => { setError(null); setOpen(true); }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Plus size={14} aria-hidden="true" /> Add new skill
        </button>
      </div>

      {sent && (
        <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          "{sent}" was sent to the admin. We'll tell you when it's approved.
        </p>
      )}

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {data.skills.length === 0 && pending.length === 0 && (
          <li className="text-xs text-slate-500">No skills yet. Tap "Add new skill" to request one.</li>
        )}
        {data.skills.map((s) => (
          <li key={s} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">
            <BadgeCheck size={13} aria-hidden="true" /> {s}
          </li>
        ))}
        {pending.map((r) => (
          <li key={r.id} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            <Clock3 size={13} aria-hidden="true" /> {r.name} <span className="font-normal">· Pending approval</span>
          </li>
        ))}
      </ul>

      {rejected.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {rejected.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
              <span className="min-w-0">
                <b>{r.name}</b> was not approved{r.reviewNote ? `: ${r.reviewNote}` : "."}
              </span>
              <button type="button" disabled={busy} onClick={() => void submit(r.name)} className="inline-flex shrink-0 items-center gap-1 font-bold text-red-700 underline disabled:opacity-50">
                <RotateCcw size={12} aria-hidden="true" /> Ask again
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-title`}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <h3 id={`${inputId}-title`} className="text-base font-bold text-slate-900">Add a new skill</h3>
              <button type="button" onClick={() => !busy && setOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Type the skill you can do. The HomeCareX admin will check it before it is added to your profile.</p>
            <label htmlFor={inputId} className="mt-3 block text-xs font-semibold text-slate-700">Skill name</label>
            <input
              id={inputId}
              autoFocus
              value={name}
              maxLength={MAX_LEN}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) void submit(name); }}
              placeholder="e.g. Sofa deep cleaning"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={busy || name.trim().length < 2} onClick={() => void submit(name)} className="flex-1 rounded-xl bg-indigo-700 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {busy ? "Sending…" : "Send for approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
