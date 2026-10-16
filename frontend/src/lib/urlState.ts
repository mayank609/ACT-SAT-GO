import { useCallback } from 'react';
import { useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';

/**
 * State kept in the URL query string, so each screen change is a browser
 * history step and the Back button returns to the previous screen instead of
 * leaving the page.
 *
 * Several setter calls in the same click (e.g. pick student + switch view) are
 * merged into ONE history entry. Setting a value that is already current does
 * nothing. Pass `{ replace: true }` for changes that should not add a step
 * (e.g. clean-up inside effects).
 */

let pending: URLSearchParams | null = null;
let pendingReplace = true;
let pendingNavigate: NavigateFunction | null = null;

function flush() {
  const params = pending;
  const nav = pendingNavigate;
  const replace = pendingReplace;
  pending = null;
  pendingReplace = true;
  pendingNavigate = null;
  if (!params || !nav) return;
  const next = params.toString();
  if (next === window.location.search.replace(/^\?/, '')) return;
  nav({ search: next ? `?${next}` : '' }, { replace, preventScrollReset: true });
}

function queue(navigate: NavigateFunction, key: string, value: string, replace: boolean) {
  if (!pending) {
    pending = new URLSearchParams(window.location.search);
    queueMicrotask(flush);
  }
  if (value) pending.set(key, value);
  else pending.delete(key);
  // One pushed change makes the whole batch a new history step.
  if (!replace) pendingReplace = false;
  pendingNavigate = navigate;
}

type SetOpts = { replace?: boolean };

/** A string kept in `?key=`; empty string removes the key. */
export function useUrlString(key: string, fallback = '') {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const value = params.get(key) ?? fallback;
  const set = useCallback(
    (v: string, opts?: SetOpts) => queue(navigate, key, v === fallback ? '' : v, !!opts?.replace),
    [navigate, key, fallback],
  );
  return [value, set] as const;
}

/** A boolean kept in `?key=1`. */
export function useUrlFlag(key: string) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const value = params.get(key) === '1';
  const set = useCallback(
    (v: boolean, opts?: SetOpts) => queue(navigate, key, v ? '1' : '', !!opts?.replace),
    [navigate, key],
  );
  return [value, set] as const;
}
