export const useIsClient = () => {
  const isClient = typeof window !== 'undefined';
  return isClient;
};
