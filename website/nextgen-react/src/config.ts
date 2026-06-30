// Where the "Login" button sends users — the test-platform app's login page.
// Override per-environment by setting VITE_APP_LOGIN_URL in a .env file
// (e.g. VITE_APP_LOGIN_URL=https://app.actsatgo.com/login). The default points
// at the local frontend dev server.
export const APP_LOGIN_URL =
  import.meta.env.VITE_APP_LOGIN_URL ?? 'http://localhost:5173/login';

// Base URL of the Node query-server that stores consultation leads and powers
// the admin dashboard. Override with VITE_QUERY_API_BASE in a .env file.
export const QUERY_API_BASE =
  import.meta.env.VITE_QUERY_API_BASE ?? 'http://localhost:5005';
