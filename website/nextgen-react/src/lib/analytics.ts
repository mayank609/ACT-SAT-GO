import { SITE } from '../site';
import { initMetaPixel, trackLead as trackMetaLead } from './metaPixel';

// Google Analytics 4 + Meta Pixel + first-touch UTM attribution.
// Everything is a no-op during prerendering (no window) and when the matching
// ID is not configured, so local builds stay silent.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'] as const;
const ATTRIBUTION_KEY = 'asg_attribution';

let gaReady = false;

function initGA4(): void {
  if (gaReady || !SITE.ga4Id) return;
  gaReady = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js requires the real `arguments` object, not a spread array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  // Page views are sent manually on every client-side route change.
  window.gtag('config', SITE.ga4Id, { send_page_view: false });
  if (SITE.adsConversion) window.gtag('config', SITE.adsConversion.split('/')[0]);

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${SITE.ga4Id}`;
  document.head.appendChild(s);
}

/** Remembers the first campaign that brought this visitor in (per tab session). */
function captureAttribution(): void {
  try {
    if (sessionStorage.getItem(ATTRIBUTION_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const data: Record<string, string> = {};
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) data[k] = v.slice(0, 120);
    });
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
      data.referrer = document.referrer.slice(0, 200);
    }
    data.landing = window.location.pathname;
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(data));
  } catch {
    /* storage blocked — attribution is best-effort */
  }
}

function getAttribution(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Lead "source" string for the CRM, e.g. "Website · google/cpc/sat-search · /sat".
 * Lets the team see which campaign produced paying students, not just leads.
 */
export function leadSource(base = 'Website'): string {
  const a = getAttribution();
  const campaign = [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join('/');
  const click = a.gclid ? 'gclid' : a.fbclid ? 'fbclid' : '';
  return [base, campaign || click || (a.referrer ? `ref:${a.referrer}` : ''), a.landing]
    .filter(Boolean)
    .join(' · ');
}

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  captureAttribution();
  initMetaPixel();
  initGA4();
}

/** Called on every route change (including the first render). */
export function trackPageView(path: string, title: string): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', 'page_view', { page_path: path, page_title: title, page_location: window.location.href });
}

let lastPixelPath = '';
/** Meta Pixel PageView for client-side navigations (the first one fires on init). */
export function trackPixelNavigation(path: string): void {
  if (typeof window === 'undefined') return;
  if (lastPixelPath && lastPixelPath !== path) window.fbq?.('track', 'PageView');
  lastPixelPath = path;
}

/** Fire on every successful lead form submission. */
export function trackLead(formName: string, extra: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  trackMetaLead();
  window.gtag?.('event', 'generate_lead', { form_name: formName, ...getAttribution(), ...extra });
  if (SITE.adsConversion) window.gtag?.('event', 'conversion', { send_to: SITE.adsConversion });
}

/** Fire when a visitor clicks through to the booking calendar / call / WhatsApp. */
export function trackContactClick(channel: 'booking' | 'phone' | 'whatsapp' | 'email'): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', 'contact_click', { channel });
  window.fbq?.('track', 'Contact', { channel });
}

/** Fire when a visitor downloads or opens a free resource (e.g. an AP guide PDF). */
export function trackDownload(resource: string, action: 'download' | 'open' = 'download'): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', 'file_download', { file_name: resource, link_action: action, resource_type: 'ap_guide' });
}
