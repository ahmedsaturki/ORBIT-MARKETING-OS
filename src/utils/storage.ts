/**
 * Safe LocalStorage helpers with error handling and fallback defaults.
 */

export function safeGetStorage<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === "undefined" || !window.localStorage)
      return defaultValue;
    const item = window.localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed: unknown = JSON.parse(item);
    return parsed !== null && parsed !== undefined
      ? (parsed as T)
      : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function safeSetStorage<T>(key: string, value: T): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy text through the standards-based Clipboard API when available.
 */
export async function safeCopy(text: string): Promise<boolean> {
  try {
    if (!navigator?.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
