import { notFound } from "next/navigation";
import { FunnelView } from "./FunnelView";

/** Development-only view of the local event funnel. Not part of the product. */
export default function FunnelPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FunnelView />;
}
