/** No-op `next/cache` for unit tests. */
export function revalidatePath(_path: string, _type?: string) {}
export function revalidateTag(_tag: string) {}
export function unstable_cache<T extends (...a: never[]) => unknown>(fn: T): T {
  return fn;
}
