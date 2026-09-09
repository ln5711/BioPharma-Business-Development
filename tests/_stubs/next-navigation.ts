/** `next/navigation` stub: redirect() throws a catchable marker carrying the target. */
export class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
    this.name = "RedirectError";
  }
}
export function redirect(url: string): never {
  throw new RedirectError(url);
}
export function notFound(): never {
  throw new Error("NEXT_NOT_FOUND");
}
