import { useRef } from 'react';

export function useCheckDep(
  deps: Record<string, unknown>,
  namespace?: string
): void {
  const map = useRef(new Map<string, unknown>());
  const result = [];
  for (const [entry, value] of Object.entries(deps)) {
    const stored = map.current.get(entry);

    if (stored === undefined) {
      map.current.set(entry, value);
    } else if (value !== stored) {
      result.push({ entry, stored, now: value });
      map.current.set(entry, value);
    }
  }
  console.log(`${namespace ?? ''}:`, result);
}
