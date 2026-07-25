import { META_PIXEL_ID } from '../config';

// Meta (Facebook) Pixel — loaded only when a Pixel ID is configured, so builds
// without one stay silent. See META_PIXEL_ID in config.ts.
const PIXEL_ID = META_PIXEL_ID;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: (...args: unknown[]) => void };
    _fbq?: Window['fbq'];
  }
}

let initialized = false;

export function initMetaPixel(): void {
  if (initialized || !PIXEL_ID || typeof window === 'undefined') return;
  initialized = true;

  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq?.('init', PIXEL_ID);
  window.fbq?.('track', 'PageView');
}

export function trackLead(): void {
  if (!PIXEL_ID || typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', 'Lead');
}
