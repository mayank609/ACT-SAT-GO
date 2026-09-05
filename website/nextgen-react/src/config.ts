// Where the "Login" button sends users — the test-platform app's login page.
// Override per-environment by setting VITE_APP_LOGIN_URL in a .env file
// (e.g. VITE_APP_LOGIN_URL=https://app.actsatgo.com/login). The default points
// at the local frontend dev server.
export const APP_LOGIN_URL =
  import.meta.env.VITE_APP_LOGIN_URL ?? 'https://act-sat-go-w3kf.vercel.app/login';

// Base URL of the Node query-server that stores consultation leads and powers
// the admin dashboard. Override with VITE_QUERY_API_BASE in a .env file.
// In production on Vercel, this defaults to an empty string so requests are routed
// relatively on the same domain, preventing CORS issues.
export const QUERY_API_BASE =
  import.meta.env.VITE_QUERY_API_BASE ?? (import.meta.env.PROD ? '' : 'http://localhost:5005');

// Base URL of the platform (Next.js) API — used by the Free Demo Test signup.
// NOTE: this must be the *platform* deployment (Render), NOT the frontend SPA on
// Vercel: the SPA rewrites every path to index.html, so /api/* calls there fail
// CORS preflight and surface in the browser as "Failed to fetch".
// Set VITE_PLATFORM_API_BASE=http://localhost:3000 in .env when running the
// platform locally.
export const PLATFORM_API_BASE =
  import.meta.env.VITE_PLATFORM_API_BASE ?? 'https://act-sat-go.onrender.com';

// Meta (Facebook) Pixel ID from Meta Events Manager, used for lead tracking on
// the consultation forms. Override with VITE_META_PIXEL_ID in a .env file.
export const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID ?? '1271262211876885';
