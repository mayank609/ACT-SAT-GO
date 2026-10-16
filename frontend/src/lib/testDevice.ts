// Tests may only be taken on a laptop/desktop. A device is "blocked" when:
//  - the viewport is phone-sized (narrower than Tailwind's `md`, 768px), or
//  - it is touch-only (no fine pointer such as a mouse/trackpad) and its
//    screen is phone-sized — this catches a phone held in landscape, whose
//    viewport can be wider than 768px.
// Tablets (touch-only but with a screen of 768px+) are not blocked.
export const PHONE_MAX_WIDTH = 767;
export const TEST_DEVICE_MESSAGE = 'Tests can only be taken on a laptop or desktop computer';

const PHONE_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px)`;
const TOUCH_ONLY_QUERY = '(pointer: coarse) and (not (any-pointer: fine))';

function mq(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function isTestBlockedDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (mq(PHONE_QUERY)) return true;
  const shortSide = Math.min(window.screen?.width ?? Infinity, window.screen?.height ?? Infinity);
  return mq(TOUCH_ONLY_QUERY) && shortSide <= PHONE_MAX_WIDTH;
}

/** Media queries whose changes can flip isTestBlockedDevice() (for live updates). */
export const TEST_DEVICE_QUERIES = [PHONE_QUERY, TOUCH_ONLY_QUERY];
