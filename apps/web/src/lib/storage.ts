// localStorage that never throws (private windows, blocked site data):
// a failed read is "nothing saved", a failed write is ignored.
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // nothing to do: the value just won't survive a reload
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // same
    }
  },
};
