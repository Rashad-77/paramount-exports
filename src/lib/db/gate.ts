import type postgres from "postgres";

/**
 * Supabase's transaction pooler never answers a query that has to wait for a free connection inside the database driver, and the staff
 * dashboard asks about a dozen things at once. This puts the waiting on our side instead: at most `limit` queries (or transactions) are
 * handed to the driver at a time, the rest wait their turn in order, so the driver never has to queue anything.
 *
 * A query handed over by the ORM is lazy (nothing is sent until it is awaited), so the gate only has to hold back the moment it is awaited.
 */
export function gateConcurrency<T extends postgres.Sql>(sql: T, limit: number): T {
  let active = 0;
  const waiting: Array<() => void> = [];
  const take = () =>
    new Promise<void>((resolve) => {
      if (active < limit) {
        active += 1;
        resolve();
      } else {
        waiting.push(() => {
          active += 1;
          resolve();
        });
      }
    });
  const give = () => {
    active -= 1;
    waiting.shift()?.();
  };

  type Lazy = PromiseLike<unknown> & Record<string, unknown>;
  const wrap = (query: Lazy): Lazy => {
    let run: Promise<unknown> | undefined;
    const start = () => (run ??= take().then(() => Promise.resolve(query).then((v) => (give(), v), (e) => (give(), Promise.reject(e)))));
    return new Proxy(query, {
      get(target, prop) {
        if (prop === "then") return (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => start().then(ok, bad);
        if (prop === "catch") return (bad?: (e: unknown) => unknown) => start().catch(bad);
        if (prop === "finally") return (done?: () => void) => start().finally(done);
        if (prop === "execute") return () => (start(), receiverOf(target));
        const value = Reflect.get(target, prop) as unknown;
        if (prop === "values" || prop === "raw") return (...args: unknown[]) => wrap((value as (...a: unknown[]) => Lazy).apply(target, args));
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
  };
  const receiverOf = (q: Lazy) => q;

  return new Proxy(sql, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown;
      if (prop === "unsafe") return (...args: unknown[]) => wrap((value as (...a: unknown[]) => Lazy).apply(target, args));
      if (prop === "begin") {
        // A transaction holds one connection from start to finish, so it takes one place in line.
        return (...args: unknown[]) => take().then(() => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args)).finally(give);
      }
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}
