declare module 'debounce-collect' {
  // Define the type for the callback that receives collected arguments
  // Assuming the original function takes args of type A
  // The callback receives an array of arrays of those args: TArgs[]
  type CollectorCallback<TArgs extends unknown[]> = (collectedArgs: TArgs[]) => void;

  // Define the type for the debounced function returned
  // It should have the same signature as the original function
  type DebouncedFunction<TArgs extends unknown[]> = (...args: TArgs) => void;

  // Define the main export function
  function debounceCollect<TArgs extends unknown[]>(
    callback: CollectorCallback<TArgs>,
    wait: number,
  ): DebouncedFunction<TArgs>;

  export default debounceCollect;
} 