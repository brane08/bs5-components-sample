import { afterEach, vi } from 'vitest';

// Jasmine restored spies and clocks after every spec; keep that behaviour so no test leaks into the next.
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
