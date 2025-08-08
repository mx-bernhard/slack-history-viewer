declare module 'debounce-collect' {
  type CollectorCallback<TArgs extends unknown[]> = (collectedArgs: TArgs[]) => void;
  type DebouncedFunction<TArgs extends unknown[]> = (...args: TArgs) => void;
  function debounceCollect<TArgs extends unknown[]>(
    callback: CollectorCallback<TArgs>,
    wait: number,
  ): DebouncedFunction<TArgs>;
  export default debounceCollect;
} 