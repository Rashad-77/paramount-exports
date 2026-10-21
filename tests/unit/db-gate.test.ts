import { describe, expect, it } from "vitest";
import type postgres from "postgres";
import { gateConcurrency } from "@/lib/db/gate";

/** Behaves like the driver's lazy query: nothing starts until it is awaited. */
function fakeDriver() {
  const state = { active: 0, peak: 0, started: [] as string[], begun: 0 };
  const waiters: Array<() => void> = [];
  const release = () => waiters.shift()?.();
  class Lazy {
    constructor(private readonly name: string) {}
    private promise?: Promise<unknown>;
    private run() {
      return (this.promise ??= new Promise<unknown>((resolve) => {
        state.active += 1;
        state.peak = Math.max(state.peak, state.active);
        state.started.push(this.name);
        waiters.push(() => {
          state.active -= 1;
          resolve(this.name);
        });
      }));
    }
    then(ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) {
      return this.run().then(ok, bad);
    }
    values() {
      return this;
    }
  }
  const sql = {
    unsafe: (name: string) => new Lazy(name),
    begin: async (fn: () => Promise<unknown>) => {
      state.begun += 1;
      return fn();
    },
    end: async () => undefined,
  };
  return { sql: sql as unknown as postgres.Sql, state, release };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("database gate", () => {
  it("never runs more queries at once than the limit, and keeps the order", async () => {
    const { sql, state, release } = fakeDriver();
    const gated = gateConcurrency(sql, 3) as unknown as { unsafe: (n: string) => PromiseLike<string> };
    const done = Array.from({ length: 10 }, (_, i) => Promise.resolve(gated.unsafe(`q${i}`)));
    await tick();
    expect(state.active).toBe(3);
    expect(state.started).toEqual(["q0", "q1", "q2"]);
    for (let i = 0; i < 10; i++) {
      release();
      await tick();
    }
    expect(await Promise.all(done)).toEqual(Array.from({ length: 10 }, (_, i) => `q${i}`));
    expect(state.peak).toBe(3);
    expect(state.started).toEqual(Array.from({ length: 10 }, (_, i) => `q${i}`));
  });

  it("does nothing until a query is awaited, and still works through .values()", async () => {
    const { sql, state, release } = fakeDriver();
    const gated = gateConcurrency(sql, 2) as unknown as { unsafe: (n: string) => { values: () => PromiseLike<string> } };
    const lazy = gated.unsafe("lazy").values();
    await tick();
    expect(state.started).toEqual([]);
    const result = Promise.resolve(lazy);
    await tick();
    expect(state.started).toEqual(["lazy"]);
    release();
    expect(await result).toBe("lazy");
  });

  it("gives its place back when a query fails", async () => {
    const calls: string[] = [];
    const failing = {
      unsafe: (name: string) => ({
        then: (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
          calls.push(name);
          return (name === "bad" ? Promise.reject(new Error("boom")) : Promise.resolve(name)).then(ok, bad);
        },
      }),
    } as unknown as postgres.Sql;
    const gated = gateConcurrency(failing, 1) as unknown as { unsafe: (n: string) => PromiseLike<string> };
    const first = Promise.resolve(gated.unsafe("bad")).catch((e: Error) => e.message);
    const second = Promise.resolve(gated.unsafe("good"));
    expect(await first).toBe("boom");
    expect(await second).toBe("good");
    expect(calls).toEqual(["bad", "good"]);
  });

  it("counts a transaction as one place and passes everything else straight through", async () => {
    const { sql, state } = fakeDriver();
    const gated = gateConcurrency(sql, 2);
    expect(await (gated as unknown as { begin: (f: () => Promise<string>) => Promise<string> }).begin(async () => "tx")).toBe("tx");
    expect(state.begun).toBe(1);
    await expect(gated.end()).resolves.toBeUndefined();
  });
});
