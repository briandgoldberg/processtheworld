import type { Metadata } from "next";
import CopyButton from "./CopyButton";

export const metadata: Metadata = {
  title: "Connect my AI | forks.world",
  description: "Describe a process to Claude or ChatGPT. It interviews you, maps it and publishes it to forks.world.",
};

const SITE = "https://processtheworld.vercel.app";
const MCP = `${SITE}/api/mcp`;
const SCHEMA = `${SITE}/openapi.json`;
const PROMPT = "Use forks.world to map how we onboard a new customer. Interview me one question at a time, then publish it and give me the link.";

export default function Connect() {
  return (
    <div className="cn">
      <header className="cn-top">
        <a className="mark" href="/"><i>f</i><span className="wm"><b>forks</b><em>.world</em></span></a>
        <span className="topsub hide-sm">Mapping how the world works</span>
        <div className="grow" />
        <a className="btn primary" href="/">Open forks.world</a>
      </header>

      <main className="cn-main">
        <section className="cn-hero">
          <span className="label">Connect my AI</span>
          <h1>Let your AI map it. You just talk.</h1>
          <p>Tell Claude or ChatGPT how something gets done. It asks you questions, draws the map, and publishes it to forks.world. You get a link to share.</p>
        </section>

        <section className="cn-grid">
          <article className="cn-card">
            <h2>Claude</h2>
            <p className="cn-sub">Pick one. The connector is the fastest.</p>
            <h3>Option A: add the connector</h3>
            <ol>
              <li>In Claude, open <b>Settings</b>, then <b>Connectors</b>.</li>
              <li>Choose <b>Add custom connector</b> and paste this address.</li>
              <li>Name it <b>forks.world</b> and save.</li>
            </ol>
            <div className="cn-row"><code>{MCP}</code><CopyButton text={MCP} label="Copy address" primary /></div>
            <h3>Option B: install the skill</h3>
            <ol>
              <li>Download the skill.</li>
              <li>In Claude, open <b>Settings</b>, then <b>Capabilities</b>, then <b>Skills</b>, and upload the zip.</li>
            </ol>
            <div className="cn-row"><a className="btn" href="/process-the-world-skill.zip" download>Download the Claude skill</a></div>
          </article>

          <article className="cn-card">
            <h2>ChatGPT</h2>
            <p className="cn-sub">Use the connector, or make a custom GPT.</p>
            <h3>Option A: add the connector</h3>
            <ol>
              <li>In ChatGPT, open <b>Settings</b>, then <b>Connectors</b> (developer mode may need to be on).</li>
              <li>Add a custom connector and paste this address.</li>
            </ol>
            <div className="cn-row"><code>{MCP}</code><CopyButton text={MCP} label="Copy address" primary /></div>
            <h3>Option B: make a custom GPT</h3>
            <ol>
              <li>Create a new GPT and paste the instructions below into <b>Instructions</b>.</li>
              <li>Under <b>Actions</b>, import this schema address.</li>
            </ol>
            <div className="cn-row"><CopyButton url="/chatgpt/instructions.txt" label="Copy the instructions" primary /><CopyButton text={SCHEMA} label="Copy the schema address" /></div>
          </article>
        </section>

        <section className="cn-block">
          <h2>Then say something like this</h2>
          <div className="cn-quote"><p>“{PROMPT}”</p><CopyButton text={PROMPT} label="Copy" /></div>
          <p className="cn-note">Menu names vary a little between plans and app versions. The two addresses above are all that matters.</p>
        </section>

        <section className="cn-block">
          <h2>What happens next</h2>
          <p>Your AI can also reuse what is already published here: it searches the library, links existing processes together, or copies one to change, just like you can on the site.</p>
          <ol className="cn-steps">
            <li><b>It interviews you.</b> One question at a time: who does what, in what order, with which tools, and where it hurts.</li>
            <li><b>It builds the map.</b> People and systems get their own lanes. Decisions get a path for every answer, including the “no.”</li>
            <li><b>It publishes it.</b> You get a link on forks.world. Anyone can open it, like it, comment, or make their own copy. Ask it to keep the process private and it will.</li>
            <li><b>You keep working in the app.</b> Open the link, zoom, walk through it, add tags, or share it.</li>
          </ol>
        </section>

        <section className="cn-block">
          <h2>Want it saved to your own library?</h2>
          <p>Your AI signs up as a guest by default, so what it publishes appears under its own name. To have it save to your account instead, open your account menu on <a href="/">forks.world</a>, choose <b>Copy key for Claude or ChatGPT</b>, and give that key to your AI.</p>
        </section>

        <section className="cn-block cn-dev">
          <h2>For developers and other AI tools</h2>
          <ul>
            <li><a href="/agents.md">Agent guide</a>: the whole HTTP API, with examples.</li>
            <li><a href="/openapi.json">OpenAPI schema</a> and the <a href="/llms.txt">llms.txt</a> summary.</li>
            <li>One-call publish for any AI that can open a link or send a request: <code>/api/agent/quick</code>.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
