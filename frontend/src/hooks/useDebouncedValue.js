import { useEffect, useState } from 'react';

/**
 * Keep controlled inputs responsive while delaying expensive local filtering.
 * This hook does not delay typing or mutate the input value.
 */
export function useDebouncedValue(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebouncedValue;
