import { describe, test, expect, vi } from 'vitest';

// Test core logic of useAsyncAction without React hooks
// The hook uses useRef + useState, but the core protection logic is:
// 1. Check runningRef → skip if already running
// 2. Set running, call fn, reset running in finally

describe('useAsyncAction — core double-click protection logic', () => {
  // Simulate the ref-based guard pattern used in the hook
  function createGuardedAction(fn) {
    let running = false;
    return async (...args) => {
      if (running) return;
      running = true;
      try {
        return await fn(...args);
      } finally {
        running = false;
      }
    };
  }

  test('blocks concurrent calls', async () => {
    let resolve;
    const fn = vi.fn(() => new Promise(r => { resolve = r; }));
    const guarded = createGuardedAction(fn);

    const p1 = guarded();
    guarded(); // second call — should be ignored
    guarded(); // third call — should be ignored
    expect(fn).toHaveBeenCalledTimes(1);

    resolve('done');
    await p1;
  });

  test('allows next call after first completes', async () => {
    const fn = vi.fn(async () => 'ok');
    const guarded = createGuardedAction(fn);

    await guarded();
    await guarded();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('passes arguments through', async () => {
    const fn = vi.fn(async (a, b) => a + b);
    const guarded = createGuardedAction(fn);

    const result = await guarded(2, 3);
    expect(fn).toHaveBeenCalledWith(2, 3);
    expect(result).toBe(5);
  });

  test('resets guard on error — next call still works', async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error('fail');
      return 'ok';
    });
    const guarded = createGuardedAction(fn);

    try { await guarded(); } catch {}
    const result = await guarded();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toBe('ok');
  });

  test('returns undefined when blocked', async () => {
    let resolve;
    const fn = vi.fn(() => new Promise(r => { resolve = r; }));
    const guarded = createGuardedAction(fn);

    guarded(); // start first
    const blocked = await guarded(); // blocked
    expect(blocked).toBeUndefined();

    resolve();
  });
});
