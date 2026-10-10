import type { Metadata } from "next";
import Studio from "../Studio";

export const metadata: Metadata = {
  title: "Connect my AI | forks.world",
  description: "Describe a process to Claude or ChatGPT. It asks the questions, draws the process map and publishes it on forks.world.",
};

// The Connect my AI page is part of the app, so the header is identical to the home page.
export default function Connect() {
  return <Studio connect />;
}
