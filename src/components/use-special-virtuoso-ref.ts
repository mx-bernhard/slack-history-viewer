import { useRef, useState } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';

/**
 * Virtuoso does not like callback refs and react quits with infinite loop error. Hence we create a
 * ref that looks like the mutable object one but is still observable for us (by using a setter).
 */
export const useSpecialVirtuosoRef = () => {
  const [virtuosoAvailable, setVirtuosoAvailable] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);

  const [virtuosoRefWrapper] = useState(() => {
    return {
      get current() {
        return virtuosoRef.current;
      },
      set current(newValue) {
        virtuosoRef.current = newValue;
        setVirtuosoAvailable(newValue != null);
      },
    };
  });

  return {
    virtuosoAvailable,
    virtuosoRef: virtuosoRefWrapper,
  };
};
