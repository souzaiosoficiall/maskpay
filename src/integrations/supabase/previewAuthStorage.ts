/**
 * Auth storage for MaskPay. Uses localStorage (browser / PWA).
 * Preview broker hooks are no-ops outside a controlled embed.
 */
export function brokeredPreviewStorage(): Storage {
  if (typeof window === "undefined") {
    // SSR noop
    return {
      get length() { return 0; },
      clear() {},
      getItem() { return null; },
      key() { return null; },
      removeItem() {},
      setItem() {},
    } as Storage;
  }

  return {
    get length() {
      return localStorage.length;
    },
    clear() {
      localStorage.clear();
    },
    getItem(key: string) {
      return localStorage.getItem(key);
    },
    key(index: number) {
      return localStorage.key(index);
    },
    removeItem(key: string) {
      localStorage.removeItem(key);
    },
    setItem(key: string, value: string) {
      localStorage.setItem(key, value);
    },
  };
}
