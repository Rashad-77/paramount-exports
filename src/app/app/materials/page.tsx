import { StockView } from "@/components/app/stock-view";
import type { SP } from "@/lib/list-params";

export const metadata = { title: "Inventory" };

/** Raw materials and consumables: the same stock view, limited to materials. */
export default function MaterialsPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <StockView searchParams={searchParams} materials />;
}
