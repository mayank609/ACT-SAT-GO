import { useSyncExternalStore } from 'react';
import { isTestBlockedDevice, TEST_DEVICE_QUERIES } from '../lib/testDevice';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const lists = TEST_DEVICE_QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener('change', onChange));
  window.addEventListener('resize', onChange);
  return () => {
    lists.forEach((l) => l.removeEventListener('change', onChange));
    window.removeEventListener('resize', onChange);
  };
}

/** True on phones / phone-sized screens, where tests must not be started or resumed. */
export function useTestBlockedDevice(): boolean {
  return useSyncExternalStore(subscribe, isTestBlockedDevice, () => false);
}
