/**
 * Safe LocalStorage helpers with error handling and fallback defaults
 */

export function safeGetStorage<T>(key: string, defaultValue: T): T {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return defaultValue;
    }
    const item = window.localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed = JSON.parse(item);
    return parsed !== null && parsed !== undefined ? parsed : defaultValue;
  } catch (err) {
        return defaultValue;
  }
}

export function safeSetStorage<T>(key: string, value: T): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
        return false;
  }
}

/**
 * Safe clipboard copy with fallback for iframe / security restrictions
 */
export async function safeCopy(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // Clipboard API might fail inside restricted iframes
  }

  // Fallback using textarea execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    void err;
    return false;
  }
}
