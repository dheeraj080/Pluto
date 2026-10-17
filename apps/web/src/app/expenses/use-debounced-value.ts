"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` once it has stopped changing for `delay` ms.
 *
 * Keeps a text field from firing a request per keystroke. The state write
 * happens inside the timeout rather than during the effect body, which keeps it
 * clear of the `react-hooks/set-state-in-effect` rule. Mirrors
 * `apps/mobile/src/hooks/use-debounced-value.ts`.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
