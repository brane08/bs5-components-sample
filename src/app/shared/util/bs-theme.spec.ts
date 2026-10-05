import { closeButtonTheme, resolvePath } from './bs-theme';

describe('bs-theme utils', () => {
  it('closeButtonTheme returns dark for dark backgrounds only', () => {
    expect(closeButtonTheme('toast text-bg-success')).toBe('dark');
    expect(closeButtonTheme('bg-dark')).toBe('dark');
    expect(closeButtonTheme('text-bg-warning')).toBeNull();
    expect(closeButtonTheme('')).toBeNull();
    expect(closeButtonTheme(null)).toBeNull();
    expect(closeButtonTheme(undefined)).toBeNull();
  });

  it('resolvePath reads direct keys and dotted paths', () => {
    const obj = { 'a.b': 1, a: { b: 2, c: null }, x: 0 };
    expect(resolvePath(obj, 'a.b')).toBe(1);
    expect(resolvePath({ a: { b: 2 } }, 'a.b')).toBe(2);
    expect(resolvePath(obj, 'x')).toBe(0);
    expect(resolvePath(obj, 'a.c.d')).toBeUndefined();
    expect(resolvePath(null, 'a')).toBeUndefined();
    expect(resolvePath('text', 'length')).toBeUndefined();
  });
});
