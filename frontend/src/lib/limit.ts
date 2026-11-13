/**
 * Run `work` over `items`, at most `limit` at a time, answers in the items' order.
 * An Organization of hundreds reads hundreds of accounts; a browser and the
 * Operators both do better with a steady few than with all at once.
 */
export async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
  return out;
}
