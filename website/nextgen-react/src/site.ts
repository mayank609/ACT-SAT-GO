// Single source of truth for business details shown across the site (footer,
// contact page, structured data). Keep these identical to the Google Business
// Profile — search engines and parents both notice mismatches.

export const SITE = {
  name: 'ACT SAT GO',
  /** Canonical origin used for canonical URLs, sitemap.xml and Open Graph tags. */
  url: (import.meta.env.VITE_SITE_URL ?? 'https://www.actsatgo.com').replace(/\/$/, ''),
  email: 'info@actsatgo.com',
  /** US phone line — the display text and the tel: link must always match. */
  phoneDisplay: '+1 (945) 391-6179',
  phoneHref: 'tel:+19453916179',
  googleReviewUrl: 'https://g.page/r/CaMyM5bggIx1EBM/review',
  socials: {
    facebook: 'https://www.facebook.com/actsatgousa',
    instagram: 'https://www.instagram.com/act_sat_go',
    youtube: 'https://www.youtube.com/@ACTSATGOTutoring',
    linkedin: 'https://www.linkedin.com/company/act-sat-go/',
  },
  /**
   * Self-booking calendar (Calendly, Cal.com, …) for the free diagnostic
   * lesson. When set, the consultation page embeds it above the form.
   * Set VITE_BOOKING_URL, e.g. https://calendly.com/actsatgo/free-diagnostic
   */
  bookingUrl: import.meta.env.VITE_BOOKING_URL ?? '',
  /** Google Analytics 4 measurement ID (G-XXXXXXX). Leave empty to disable. */
  ga4Id: import.meta.env.VITE_GA4_ID ?? '',
  /** Google Ads conversion target "AW-XXXXXXX/label". Leave empty to disable. */
  adsConversion: import.meta.env.VITE_GOOGLE_ADS_CONVERSION ?? '',
};

/** The one name for the primary call to action, used everywhere. */
export const PRIMARY_CTA = 'Book a Free Diagnostic Lesson';
/** Soft offer for visitors not ready to talk to anyone yet. */
export const SECONDARY_CTA = 'Take a Free Practice Test';
export const CONSULT_PATH = '/consultation';
