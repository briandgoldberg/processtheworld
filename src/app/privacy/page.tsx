import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What forks.world collects, why, who it is shared with, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "October 11, 2026";

export default function Privacy() {
  return (
    <main className="lib privacy">
      <p><a href="/">forks.world</a> · <a href="/library">Library</a></p>
      <h1>Privacy policy</h1>
      <p className="lib-sub">Last updated {UPDATED}</p>

      <p>forks.world turns descriptions of processes into swim-lane maps. This page explains what we collect when you use it, why, and what you can do about it. In short: you can use the site without giving us your name or email, the processes you keep private are not shown to other people, and we use what you do here to make the mapper better.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>A guest account.</b> The first time you open the site, your browser stores a random key and we create an account with an automatically chosen name. That key is how the site recognizes you; there is no password.</li>
        <li><b>Your email, if you add one.</b> It is used to send you sign-in links and to let people invite you to a process. A username you choose is shown on things you publish and comment on.</li>
        <li><b>Your processes and conversations.</b> The maps you build, what you type or say to the mapper, its replies, and the changes you make, including images you add as thumbnails.</li>
        <li><b>How you use the site.</b> Actions such as opening, copying, sharing, rating replies, skipping questions and sending feedback, with the time they happened.</li>
        <li><b>Technical data.</b> A one-way hash of your IP address, used to limit abuse and count visitors, never stored as the address itself. We also use Vercel Analytics, which counts page views without cookies.</li>
        <li><b>Things you choose to make public.</b> Published processes, comments, likes and votes on suggested changes are visible to everyone, with your username.</li>
      </ul>

      <h2>Private, shared and public processes</h2>
      <p>A private process is visible to you and to anyone you invite. Shared processes are visible to the people you share them with, at the level you choose. Published processes are public: anyone can read them, copy them and, for community processes, suggest changes.</p>
      <p>The person who runs forks.world can view any process, including private ones, from an administrator dashboard. This is used to understand how the mapper is doing, fix problems and improve it. Private processes are never published or shown to other users by us.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To run the site: save your work, sign you in, show your library, and keep track of credits.</li>
        <li>To improve forks.world. The conversations, maps, corrections and ratings people create here are how the mapper learns. We review them and may use them, including private processes, to improve how forks.world builds and checks maps.</li>
        <li>To keep the site safe and working: preventing abuse, investigating errors, and measuring cost.</li>
      </ul>
      <p>We do not sell your personal information and do not use it for advertising.</p>

      <h2>Who we share it with</h2>
      <ul>
        <li><b>Anthropic</b>, which provides the AI model (Claude). What you write to the mapper, and the current map, are sent to Anthropic to produce each reply.</li>
        <li><b>Vercel</b>, which hosts the site and its database, and provides the page-view analytics.</li>
        <li><b>Resend</b>, which sends sign-in and invitation emails.</li>
        <li><b>Your browser&apos;s speech service</b>, if you use Talk. Voice input and read-aloud use your browser&apos;s built-in speech features; depending on your browser, its maker may process that audio.</li>
        <li><b>AI agents you connect.</b> If you give Claude, ChatGPT or another tool your key, it can read and save processes in your library.</li>
        <li>Anyone, when the law requires it, or to protect the site and its users.</li>
      </ul>

      <h2>Cookies and browser storage</h2>
      <p>forks.world does not use advertising or tracking cookies. Your browser stores your account key and a few settings (such as whether you have visited before) in local storage. Clearing your browser&apos;s site data signs you out of a guest account; if you added an email, you can sign back in with a link.</p>

      <h2>How long we keep it</h2>
      <p>We keep your account and processes until you delete them or ask us to. Usage records and AI logs may be kept longer, and in anonymized or aggregated form indefinitely, to improve the mapper.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Delete any process you own from its menu.</li>
        <li>Stop sharing a process, or remove yourself from one shared with you.</li>
        <li>Use the site as a guest without an email.</li>
        <li>Ask us to delete your account and everything in it, or for a copy of your data, using the Feedback button on <a href="/">forks.world</a>. Depending on where you live, you may have further rights over your data, and we will honor them.</li>
      </ul>

      <h2>Children</h2>
      <p>forks.world is not meant for children under 13, and we do not knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>If we change this policy, we will update the date at the top of this page, and for significant changes we will say so on the site.</p>

      <h2>Contact</h2>
      <p>Questions or requests about your privacy: send them through the Feedback button in the corner of <a href="/">forks.world</a>.</p>
    </main>
  );
}
