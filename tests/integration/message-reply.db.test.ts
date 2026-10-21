import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { enquirySchema } from "@/lib/schemas/enquiry";
import { getMessage, listReplies, replyToMessage, submitEnquiry } from "@/server/messages";
import { hasTestDb } from "../helpers/db";
import { makeActor, setupApp } from "../helpers/app";

describe.skipIf(!hasTestDb)("replying to an enquiry from the site (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let staff: Actor, nobody: Actor;
  let ip = 0;
  const send = (o: Record<string, unknown>) => submitEnquiry(enquirySchema.parse({ consent: "on", fileIds: [], kind: "general", message: "Do you deliver to Galle, and how long does it take?", ...o }), { ip: `203.0.113.${++ip}` });

  beforeAll(async () => {
    t = await setupApp();
    staff = await makeActor(t, ["staff"], "Sam Staff");
    nobody = await makeActor(t, [], "No Role");
  });
  afterAll(async () => {
    await t?.teardown();
  });

  it("records the reply with who sent it and where it went, and marks the enquiry as responded", async () => {
    const { id } = await send({ name: "Kamal Silva", phone: "0771300001", email: "kamal@example.test" });
    expect((await getMessage(staff, id)).message.isHandled).toBe(false);
    const r = await replyToMessage(staff, id, "Yes, we deliver to Galle. It takes about a week.");
    expect(r).toEqual({ email: "kamal@example.test", onAccount: false });
    const replies = await listReplies(staff, id);
    expect(replies).toMatchObject([{ body: "Yes, we deliver to Galle. It takes about a week.", emailedTo: "kamal@example.test", onAccount: false, by: "Sam Staff" }]);
    const { message } = await getMessage(staff, id);
    expect(message).toMatchObject({ isHandled: true });
    expect(message.handledAt).toBeInstanceOf(Date);
    const actions = (await t.sql`SELECT action FROM audit_logs WHERE entity_id = ${id} ORDER BY created_at`).map((x) => x.action);
    expect(actions).toContain("message.replied");
  });

  it("a customer with no email and no account cannot be answered from the site", async () => {
    const { id } = await send({ name: "Nimal Perera", phone: "0771300002" });
    await expect(replyToMessage(staff, id, "Hello")).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await listReplies(staff, id)).toHaveLength(0);
    expect((await getMessage(staff, id)).message.isHandled).toBe(false);
  });

  it("people without a role cannot reply", async () => {
    const { id } = await send({ name: "Dilani Fernando", phone: "0771300003", email: "dilani@example.test" });
    await expect(replyToMessage(nobody, id, "Hello")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
