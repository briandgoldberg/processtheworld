import type { Metadata } from "next";
import Studio from "../Studio";

export const metadata: Metadata = { title: "My processes | forks.world", robots: { index: false } };

export default function Mine() {
  return <Studio mine />;
}
