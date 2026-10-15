import { NextResponse } from "next/server";
import { activeCustomer } from "@/lib/auth/customer";
import { wishlistIds } from "@/server/accounts";

export const dynamic = "force-dynamic";

/**
 * Lets the public forms pre-fill a signed-in customer's own details. Answers only about the caller's own session:
 * nothing about anyone else, and "no one" for visitors, for accounts that are switched off, and for any failure.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const c = await activeCustomer();
    if (!c) return NextResponse.json({ customer: null }, { headers });
    const wishlist = await wishlistIds(c.id).catch(() => [] as string[]);
    return NextResponse.json({ customer: { name: c.fullName, email: c.email, phone: c.phone, address: c.address, wishlist } }, { headers });
  } catch {
    return NextResponse.json({ customer: null }, { headers });
  }
}
