// Where the "Login" button sends users — the test-platform app's login page.
// Override per-environment by setting VITE_APP_LOGIN_URL in a .env file
// (e.g. VITE_APP_LOGIN_URL=https://app.actsatgo.com/login). The default points
// at the local frontend dev server.
export const APP_LOGIN_URL =
  import.meta.env.VITE_APP_LOGIN_URL ?? 'http://localhost:5173/login';
