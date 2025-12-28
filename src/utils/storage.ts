import { Item } from '../types';

const STORAGE_KEY = 'bg3-item-checklist';
// Cookie expiration: 1 year from now
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // seconds

/**
 * Set a cookie with the given name, value, and expiration
 */
function setCookie(name: string, value: string, maxAge: number): void {
  try {
    // Encode the value to handle special characters
    const encodedValue = encodeURIComponent(value);
    // Set cookie with SameSite=Lax for better compatibility
    document.cookie = `${name}=${encodedValue}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch (error) {
    console.error('Failed to set cookie:', error);
  }
}

/**
 * Get a cookie value by name
 */
function getCookie(name: string): string | null {
  try {
    const nameEQ = name + '=';
    const cookies = document.cookie.split(';');
    
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i];
      while (cookie.charAt(0) === ' ') {
        cookie = cookie.substring(1, cookie.length);
      }
      if (cookie.indexOf(nameEQ) === 0) {
        return decodeURIComponent(cookie.substring(nameEQ.length, cookie.length));
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to get cookie:', error);
    return null;
  }
}

/**
 * Load items from cookies, with localStorage fallback
 */
export const loadItems = (): Item[] => {
  try {
    // Try to load from cookie first
    const cookieData = getCookie(STORAGE_KEY);
    if (cookieData) {
      const parsed = JSON.parse(cookieData);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    
    // Fallback to localStorage if cookie is empty (for migration or if cookie failed)
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Migrate to cookie
          saveItems(parsed);
          return parsed;
        }
      }
    } catch {
      // localStorage not available or failed, that's okay
    }
    
    return [];
  } catch (error) {
    console.error('Failed to load items:', error);
    return [];
  }
};

/**
 * Save items to cookies, with localStorage fallback for large datasets
 */
export const saveItems = (items: Item[]): void => {
  try {
    const jsonString = JSON.stringify(items);
    const dataSize = jsonString.length;
    
    // Cookies have a 4KB limit (4096 bytes)
    // We'll use 4000 bytes as a safe threshold to account for cookie overhead
    if (dataSize > 4000) {
      // Data is too large for cookies, use localStorage as fallback
      console.warn('Item data exceeds cookie size limit. Using localStorage instead.');
      try {
        localStorage.setItem(STORAGE_KEY, jsonString);
        // Also try to save a truncated version in cookie as backup
        // or just clear the cookie
        setCookie(STORAGE_KEY, '', 0); // Clear cookie
        return;
      } catch (localStorageError) {
        console.error('Failed to save to localStorage:', localStorageError);
        // If both fail, at least try to save to cookie (might fail but worth trying)
      }
    }
    
    // Save to cookie (primary storage)
    setCookie(STORAGE_KEY, jsonString, COOKIE_MAX_AGE);
    
    // Also save to localStorage as backup
    try {
      localStorage.setItem(STORAGE_KEY, jsonString);
    } catch {
      // localStorage might not be available, that's okay
    }
  } catch (error) {
    console.error('Failed to save items:', error);
    // Try localStorage as last resort
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Both failed, but we tried
    }
  }
};

