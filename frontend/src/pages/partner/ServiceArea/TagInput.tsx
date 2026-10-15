import { useId, useMemo, useState } from "react";
import { addEntry } from "./serviceAreaModel";

interface Props {
  label: string;
  hint?: string;
  values: string[];
  max: number;
  placeholder: string;
  error?: string;
  onChange: (next: string[]) => void;
  /** When given, matching suggestions appear after 2 typed letters. */
  suggest?: (query: string, exclude: string[]) => string[];
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2";

/**
 * Add-by-typing list. Enter or the Add button adds; every chip has a labelled remove button.
 * With `suggest` it behaves as an accessible combobox (arrow keys, Enter, Escape).
 */
export default function TagInput({
  label,
  hint,
  values,
  max,
  placeholder,
  error,
  onChange,
  suggest,
}: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const options = useMemo(
    () => (suggest && open ? suggest(text, values) : []),
    [suggest, open, text, values],
  );
  const expanded = options.length > 0;

  const commit = (raw: string) => {
    const result = addEntry(values, raw, max);
    if (result.error) {
      setLocal(result.error);
      return;
    }
    setLocal(null);
    setText("");
    setOpen(false);
    setActive(-1);
    onChange(result.list);
  };

  const add = () => {
    if (text.trim() === "") return;
    commit(active >= 0 && options[active] ? options[active] : text);
  };

  const shown = local ?? error;
  const errId = `${id}-err`;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-brand">
        {label}
      </label>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className="relative flex min-w-0 gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            value={text}
            maxLength={80}
            placeholder={placeholder}
            autoComplete="off"
            role={suggest ? "combobox" : undefined}
            aria-expanded={suggest ? expanded : undefined}
            aria-controls={suggest ? listId : undefined}
            aria-autocomplete={suggest ? "list" : undefined}
            aria-activedescendant={
              expanded && active >= 0 ? `${id}-opt-${active}` : undefined
            }
            aria-invalid={shown ? true : undefined}
            aria-describedby={shown ? errId : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setLocal(null);
              setOpen(true);
              setActive(-1);
            }}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && suggest) {
                e.preventDefault();
                setOpen(true);
                setActive((a) =>
                  options.length ? (a + 1) % options.length : -1,
                );
              } else if (e.key === "ArrowUp" && suggest) {
                e.preventDefault();
                setActive((a) =>
                  options.length ? (a <= 0 ? options.length - 1 : a - 1) : -1,
                );
              } else if (e.key === "Escape" && expanded) {
                e.preventDefault();
                setOpen(false);
                setActive(-1);
              } else if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className={`min-h-[44px] w-full min-w-0 rounded border border-line px-3 text-sm ${focusRing}`}
          />
          {suggest && (
            <ul
              id={listId}
              role="listbox"
              aria-label={`${label} suggestions`}
              hidden={!expanded}
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded border border-line bg-white py-1 shadow-lg"
            >
              {options.map((opt, i) => (
                <li
                  key={opt}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown (not click) so the input's blur does not close the list first
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(opt);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-panel text-brand" : ""}`}
                >
                  {opt}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={add}
          className={`min-h-[44px] shrink-0 rounded border border-brand-500 px-4 text-sm font-medium text-brand ${focusRing}`}
        >
          Add
        </button>
      </div>
      {shown && (
        <p id={errId} role="alert" className="mt-1 text-xs text-red-600">
          {shown}
        </p>
      )}
      {values.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label={`${label} added`}>
          {values.map((v) => (
            <li
              key={v}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-panel py-1 pl-3 pr-1 text-sm"
            >
              <span className="min-w-0 break-words">{v}</span>
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-red-600 ${focusRing}`}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
