import { StockView } from "@/components/app/stock-view";
import type { SP } from "@/lib/list-params";

export const metadata = { title: "Inventory" };

export default function StockPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <StockView searchParams={searchParams} />;
}
