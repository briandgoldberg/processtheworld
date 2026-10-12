import type { Metadata } from "next";
import Studio from "../Studio";

export const metadata: Metadata = {
  title: "Team Processes: early access",
  description: "Build and keep processes together with your coworkers or team. Early access for coworkers and formal teams.",
};

export default function Team() {
  return <Studio team />;
}
