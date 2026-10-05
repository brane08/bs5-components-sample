const DARK_VARIANT = /(^|\s)(text-bg|bg)-(primary|secondary|success|danger|dark)(\s|$)/;

/**
 * Bootstrap 5.3 replaced `.btn-close-white` with `data-bs-theme="dark"`.
 * Returns the theme a `.btn-close` needs to stay visible on the given background classes.
 */
export function closeButtonTheme(classes: string | null | undefined): 'dark' | null {
  return classes && DARK_VARIANT.test(classes) ? 'dark' : null;
}

/** Resolves a dotted property path (`'address.city'`) on an object. */
export function resolvePath(obj: unknown, path: string): any {
  if (obj == null || typeof obj !== 'object') {
    return undefined;
  }
  if (path in (obj as object)) {
    return (obj as Record<string, unknown>)[path];
  }
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), obj);
}
