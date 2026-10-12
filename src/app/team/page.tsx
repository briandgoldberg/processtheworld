import type { Metadata } from "next";
import Studio from "../Studio";

export const metadata: Metadata = {
  title: "Team Processes: early access",
  description: "Build and keep your organization's processes together. Early access for organizations or large teams.",
};

export default function Team() {
  return <Studio team />;
}
