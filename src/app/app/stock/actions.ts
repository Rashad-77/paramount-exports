"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { itemCreateSchema, itemUpdateSchema, locationSchema, manualMovementSchema, thresholdSchema, transferSchema } from "@/lib/schemas/inventory";
import { createInventoryItem, recordManualMovement, saveLocation, setLowStockThreshold, transferStock, updateInventoryItem } from "@/server/inventory";

const refresh = (id?: string) => {
  revalidatePath("/app/stock");
  revalidatePath("/app/transfers");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/stock/${id}`);
};

export async function createItemAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, itemCreateSchema, async (input, { actor }) => {
    const id = await createInventoryItem(actor!, input);
    refresh();
    return { redirectTo: `/app/stock/${id}` };
  });
}

export async function updateItemAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, itemUpdateSchema, async (input, { actor }) => {
    await updateInventoryItem(actor!, input.id, input);
    refresh(input.id);
    return { message: "Stock item saved." };
  });
}

export async function manualMovementAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, manualMovementSchema, async (input, { actor }) => {
    await recordManualMovement(actor!, input);
    refresh(input.itemId);
    return { message: "Recorded in the stock ledger." };
  });
}

export async function thresholdAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, thresholdSchema, async (input, { actor }) => {
    await setLowStockThreshold(actor!, { itemId: input.itemId, locationId: input.locationId, threshold: input.threshold });
    refresh(input.itemId);
    return { message: input.threshold === null ? "Low-stock alert removed." : "Low-stock level saved." };
  });
}

export async function saveLocationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, locationSchema, async (input, { actor }) => {
    await saveLocation(actor!, { id: input.id, name: input.name, kind: input.kind, isActive: input.isActive });
    revalidatePath("/app/locations");
    revalidatePath("/app");
    return { redirectTo: "/app/locations" };
  });
}

export async function transferAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, transferSchema, async (input, { actor }) => {
    const r = await transferStock(actor!, { fromLocationId: input.fromLocationId, toLocationId: input.toLocationId, items: input.linesJson, note: input.note });
    refresh();
    return { message: `Transfer ${r.reference} recorded: stock left the source and arrived at the destination together.` };
  });
}
