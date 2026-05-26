import { useEffect, useState } from 'react';

/**
 * Returns the input value after it has been stable for `delayMs`.
 * Standard pattern for search inputs that fire network requests.
 *
 *   const debounced = useDebouncedValue(search, 250);
 *   const query = useQuery({ queryKey: [debounced], ... });
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
