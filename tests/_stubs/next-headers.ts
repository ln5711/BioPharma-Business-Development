/** In-memory `cookies()` stand-in for unit tests. */
const jar = new Map<string, string>();

export async function cookies() {
  return {
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  };
}

export function __clearCookies() {
  jar.clear();
}
