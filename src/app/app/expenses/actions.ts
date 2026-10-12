"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { expenseCategorySchema, expenseSchema, expenseVoidSchema } from "@/lib/schemas/operations";
import { createExpense, saveExpenseCategory, voidExpense } from "@/server/expenses";

const refresh = () => {
  revalidatePath("/app/expenses");
  revalidatePath("/app/reports");
  revalidatePath("/app");
};

export async function createExpenseAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, expenseSchema, async (input, { actor }) => {
    await createExpense(actor!, input);
    refresh();
    return { redirectTo: "/app/expenses" };
  });
}

export async function voidExpenseAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, expenseVoidSchema, async (input, { actor }) => {
    await voidExpense(actor!, input.id, input.reason);
    refresh();
    return { message: "Expense voided. It stays on record and is no longer counted." };
  });
}

export async function saveCategoryAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, expenseCategorySchema, async (input, { actor }) => {
    await saveExpenseCategory(actor!, { id: input.id, name: input.name, isActive: input.isActive });
    revalidatePath("/app/expenses/categories");
    refresh();
    return { message: "Category saved." };
  });
}
