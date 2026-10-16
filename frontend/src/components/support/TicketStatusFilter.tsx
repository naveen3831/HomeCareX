import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { label, STATUSES, type TicketStatus } from "@/features/support/types";

type StatusValue = TicketStatus | "";
const options: ReadonlyArray<{ value: StatusValue; text: string }> = [
  { value: "", text: "All statuses" },
  ...STATUSES.map((value) => ({ value, text: label(value) })),
];

interface TicketStatusFilterProps {
  value: StatusValue;
  onChange: (value: StatusValue) => void;
}

export default function TicketStatusFilter({
  value,
  onChange,
}: TicketStatusFilterProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const search = useRef({ text: "", time: 0 });
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [side, setSide] = useState<"top" | "bottom">("bottom");
  const [maxHeight, setMaxHeight] = useState(320);

  useEffect(() => {
    if (!open) return;
    const option = optionRefs.current[activeIndex];
    option?.focus({ preventScroll: true });
    const list = option?.parentElement;
    if (option && list) {
      const bottom = option.offsetTop + option.offsetHeight;
      if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
      else if (bottom > list.scrollTop + list.clientHeight)
        list.scrollTop = bottom - list.clientHeight;
    }
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      const below = window.innerHeight - box.bottom - 12;
      const above = box.top - 12;
      const useTop = below < 320 && above > below;
      setSide(useTop ? "top" : "bottom");
      setMaxHeight(Math.max(96, Math.min(320, useTop ? above : below)));
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);

  function close() {
    setOpen(false);
    search.current = { text: "", time: 0 };
    trigger.current?.focus();
  }

  function choose(next: StatusValue) {
    if (next !== value) onChange(next);
    close();
  }

  function show(index = selectedIndex) {
    trigger.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    search.current = { text: "", time: 0 };
    setActiveIndex(index);
    setOpen(true);
  }

  function findByTyping(key: string, start: number) {
    const now = Date.now();
    const text =
      (now - search.current.time > 600 ? "" : search.current.text) +
      key.toLowerCase();
    search.current = { text, time: now };
    const query = [...text].every((character) => character === text[0])
      ? text[0]
      : text;
    for (
      let offset = query.length === 1 ? 1 : 0;
      offset <= options.length;
      offset += 1
    ) {
      const index = (start + offset) % options.length;
      if (options[index].text.toLowerCase().startsWith(query)) {
        if (!open)
          trigger.current?.scrollIntoView?.({
            block: "nearest",
            inline: "nearest",
          });
        setActiveIndex(index);
        setOpen(true);
        return;
      }
    }
  }

  return (
    <div
      ref={root}
      className="hcx-support-status-filter"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={`${id}-label`} className="hcx-support-status-label">
        Status
      </span>
      <div className="hcx-support-status-control">
        <button
          ref={trigger}
          type="button"
          className="hcx-support-status-trigger"
          data-ticket-tone={value || "all"}
          aria-labelledby={`${id}-label ${id}-value`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${id}-options` : undefined}
          onClick={() => (open ? close() : show())}
          onKeyDown={(event) => {
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              show(
                event.key === "End" || event.key === "ArrowUp"
                  ? options.length - 1
                  : event.key === "Home"
                    ? 0
                    : selectedIndex,
              );
            } else if (
              event.key.length === 1 &&
              event.key !== " " &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              event.preventDefault();
              findByTyping(event.key, selectedIndex);
            }
          }}
        >
          <span className="hcx-support-status-dot" aria-hidden="true" />
          <span id={`${id}-value`}>{selected.text}</span>
          <ChevronDown
            size={17}
            className="hcx-support-status-chevron"
            aria-hidden="true"
          />
        </button>
        {open && (
          <div
            id={`${id}-options`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="hcx-support-status-options"
            data-side={side}
            style={{ maxHeight }}
            onKeyDown={(event) => {
              if (
                [
                  "ArrowDown",
                  "ArrowUp",
                  "Home",
                  "End",
                  "Enter",
                  " ",
                  "Escape",
                ].includes(event.key)
              ) {
                event.preventDefault();
                event.stopPropagation();
                if (event.key === "ArrowDown")
                  setActiveIndex((index) => (index + 1) % options.length);
                else if (event.key === "ArrowUp")
                  setActiveIndex(
                    (index) => (index + options.length - 1) % options.length,
                  );
                else if (event.key === "Home") setActiveIndex(0);
                else if (event.key === "End")
                  setActiveIndex(options.length - 1);
                else if (event.key === "Escape") close();
                else choose(options[activeIndex].value);
              } else if (event.key === "Tab") {
                close();
              } else if (
                event.key.length === 1 &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
              ) {
                event.preventDefault();
                findByTyping(event.key, activeIndex);
              }
            }}
          >
            {options.map((option, index) => (
              <button
                key={option.value || "all"}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={option.value === value}
                tabIndex={activeIndex === index ? 0 : -1}
                className="hcx-support-status-option"
                data-ticket-tone={option.value || "all"}
                onFocus={() => setActiveIndex(index)}
                onClick={() => choose(option.value)}
              >
                <span className="hcx-support-status-dot" aria-hidden="true" />
                <span>{option.text}</span>
                {option.value === value && (
                  <Check
                    size={17}
                    className="hcx-support-status-check"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
