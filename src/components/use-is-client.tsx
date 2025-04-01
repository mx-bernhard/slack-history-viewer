import { useState, useEffect } from 'react';

export const useIsClient = () => {
  // State to control client-side rendering
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true after mount
  useEffect(() => {
    setIsClient(true);
  }, []);
  return isClient;
};
