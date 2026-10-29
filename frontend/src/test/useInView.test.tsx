import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useInView } from "@/hooks/useInView";

type IOCallback = (entries: { isIntersecting: boolean }[]) => void;

let callbacks: IOCallback[] = [];
const observe = vi.fn();
const original = globalThis.IntersectionObserver;

beforeEach(() => {
  callbacks = [];
  observe.mockClear();
  globalThis.IntersectionObserver = class {
    constructor(cb: IOCallback) {
      callbacks.push(cb);
    }
    observe = observe;
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = () => [];
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  globalThis.IntersectionObserver = original;
});

/** Mirrors ReviewPreview: a skeleton first, the observed element only after "loading" ends. */
function LateMount() {
  const [loaded, setLoaded] = useState(false);
  const [ref, seen] = useInView<HTMLDivElement>(0.2);
  return (
    <div>
      <button onClick={() => setLoaded(true)}>finish loading</button>
      {loaded ? <div ref={ref} data-testid="target">{seen ? "seen" : "not seen"}</div> : <p>skeleton</p>}
    </div>
  );
}

describe("useInView", () => {
  it("observes an element that mounts after the first render, then reports it seen", async () => {
    render(<LateMount />);
    expect(observe).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByText("finish loading").click();
    });
    // The bug: the observer was never attached to a late-mounted element.
    expect(observe).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("target")).toHaveTextContent("not seen");

    await act(async () => {
      callbacks.forEach((cb) => cb([{ isIntersecting: true }]));
    });
    expect(screen.getByTestId("target")).toHaveTextContent("seen");
  });
});
