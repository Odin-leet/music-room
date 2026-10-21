import { useEffect, useRef } from 'react';

// Run `load` when the page opens, and again whenever the tab / window comes
// back into view (the web version of the mobile app's useFocusEffect: data
// may have changed while you were elsewhere).
export function useLoadOnShow(load: () => void) {
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  });
  useEffect(() => {
    latest.current();
    const onShow = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [load]);
}
