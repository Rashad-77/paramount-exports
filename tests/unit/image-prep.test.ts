import { describe, expect, it } from "vitest";
import { prepareImage } from "@/lib/image-prep";

describe("prepareImage", () => {
  it("leaves a file that is not a resizable image alone", async () => {
    const pdf = new File(["x"], "plan.pdf", { type: "application/pdf" });
    expect(await prepareImage(pdf)).toBe(pdf);
  });

  it("sends the file unchanged when the browser cannot resize (no canvas)", async () => {
    const photo = new File([new Uint8Array(10)], "photo.jpg", { type: "image/jpeg" });
    expect(await prepareImage(photo)).toBe(photo);
  });
});
