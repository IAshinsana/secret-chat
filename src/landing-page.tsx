import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronRight, ExternalLink } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { FacetMark } from "@/components/marketing/facet-mark";
import { disabledSlugs } from "@/lib/admin/store";
import { pageMeta } from "@/lib/seo";
import { jsonLd, softwareAppSchema, faqSchema, breadcrumbSchema, howToSchema } from "@/lib/schema";
import { SITE, AUTHOR } from "@/lib/site";
import { getToolBySlug, TOOLS } from "@/lib/data/tools";
import { ToolCard } from "@/components/marketing/tool-card";
import { CreateChat } from "@/components/secret-chat/create-chat";

const SLUG = "secret-chat";
const tool = getToolBySlug(SLUG)!;
const TOOL_URL = `${SITE.url}${tool.href}`;

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Secret Chat — Private, Encrypted, Self-Destructing Chat (No Signup)",
  description:
    "Create an end-to-end encrypted chat or send a self-destructing secret — share a password or private message via a one-time link that nobody else can read. The key lives in your link; nothing readable is stored and it self-destructs on a timer. No signup. A free privnote-style alternative.",
  path: tool.href,
  keywords: tool.keywords,
  publishedAt: tool.publishedAt,
  updatedAt: tool.updatedAt,
});

const FAQ = [
  {
    question: "How is this actually private — can induwara.lk read my messages?",
    answer:
      "No. Your browser generates a random encryption key and puts it in the part of the link after the # (the 'fragment'), which browsers never send to any server. Every message and file is encrypted with that key before it leaves your device, so our server only ever stores ciphertext it has no key for. We genuinely cannot read your chat.",
  },
  {
    question: "Where is the chat stored, and when is it deleted?",
    answer:
      "Only encrypted blobs are stored temporarily so the other person can receive them. Everything is permanently deleted when the self-destruct timer (1, 8, or 24 hours) runs out — the server enforces this regardless of what either person does — or instantly when either of you hits Destroy. After that, even the key can't recover anything.",
  },
  {
    question: "How do I start a chat with someone?",
    answer:
      "Click Create secret chat, then copy the link and send it to one person (via any messenger). When they open it, you're connected and can chat in real time. The link contains the decryption key, so treat it like a password — anyone who has the full link can read the conversation.",
  },
  {
    question: "Can I share images and files?",
    answer:
      "Yes. Files up to 3 MB are encrypted in your browser before upload, relayed as ciphertext, and decrypted on the other side. Images preview inline; other files appear as a download. Like the messages, we can't see them, and they're destroyed with the session.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No signup, no account, no phone number, no app. Open the page, create a chat, share the link. That's the whole point — private by default with nothing tying the conversation to your identity on our side.",
  },
  {
    question: "Can I make a group chat, and how do people join?",
    answer:
      "Yes. Create a Group chat and anyone can join with the link, or with the Group ID + passphrase (handy when you can't paste a long link). Each person picks a display name and optional photo — like Telegram — and messages show who sent them. The passphrase derives the encryption key in the browser, so the server still never sees it.",
  },
  {
    question: "What are the limits and timers?",
    answer:
      "Files are up to 3 MB. Set the self-destruct timer when you create the chat: 1 hour, 8 hours, 24 hours, 1 week, 1 month, or Never. Messages appear within a couple of seconds. Groups support many participants; 1-to-1 chats are capped at two. For long-term or large-file needs a dedicated messenger is better — this is for quick, private, disposable chats.",
  },
  {
    question: "Is anything truly un-recoverable once it's gone?",
    answer:
      "Yes. We never hold the key, and we delete the ciphertext on the timer. There's no plaintext anywhere on our side at any point, so once a session expires or is destroyed there is nothing for anyone — us included — to recover.",
  },
  {
    question: "Can I chat anonymously, with no account or phone number?",
    answer:
      "Yes — there's no sign-up, no email, no phone number, and no app to install. You're never asked to identify yourself to us. In a group you choose a display name just so others can tell who's who; it's encrypted along with your messages and is gone when the chat self-destructs.",
  },
  {
    question: "Is this a Telegram or Signal alternative?",
    answer:
      "It's a lightweight, no-account alternative for quick private conversations. Telegram and Signal are full apps with accounts and message history; Secret Chat is the opposite — a disposable, link-based room that leaves nothing behind. Use it when you want to share something privately right now without anyone installing or signing up for anything.",
  },
  {
    question: "How do I send self-destructing messages?",
    answer:
      "Every message here is self-destructing by design: pick a timer (from 1 hour up to 1 month, or Never) when you create the chat, and the whole conversation — text and files — is deleted when it runs out, or instantly when anyone taps Destroy. There's no separate setting; disappearing is the default.",
  },
  {
    question: "Can I use this to send a password or secret securely (like Privnote)?",
    answer:
      "Yes — it's a strong free alternative to one-time-secret tools like Privnote. Create a chat, paste the password, API key, Wi-Fi code, or any sensitive note, set a short self-destruct timer, and send the link to the recipient. The secret is end-to-end encrypted with a key that lives only in the link, so our server never sees it, and it's permanently deleted once the timer runs out or either side opens and destroys it — far safer than emailing or messaging a password in plain text.",
  },
];

export default function SecretChatPage() {
  if (disabledSlugs().has(SLUG)) notFound();

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", url: SITE.url },
    { name: "Tools", url: `${SITE.url}/tools` },
    { name: tool.shortTitle, url: TOOL_URL },
  ]);
  const softwareApp = softwareAppSchema({
    name: tool.title, description: tool.description, url: TOOL_URL, category: "CommunicationApplication", keywords: tool.keywords,
  });
  const faq = faqSchema(FAQ);
  const relatedSlugs = new Set(["password-generator", "qr-code-generator", "hash-generator"]);
  const relatedTools = TOOLS.filter((t) => relatedSlugs.has(t.slug)).slice(0, 3);
  const howTo = howToSchema({
    name: "How to start a secret chat",
    description: "Create an end-to-end encrypted, self-destructing chat and share it with one person.",
    url: TOOL_URL,
    steps: [
      { name: "Create the chat", text: "Pick a self-destruct timer and click Create secret chat." },
      { name: "Share the link", text: "Copy the link (it contains the encryption key) and send it to one person." },
      { name: "Chat privately", text: "When they open it, chat and share media — all end-to-end encrypted." },
    ],
  });

  return (
    <article className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(softwareApp) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(howTo) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-foreground">Home</Link></li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li><Link href="/tools" className="hover:text-foreground">Tools</Link></li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li className="font-medium text-foreground">{tool.shortTitle}</li>
        </ol>
      </nav>

      <header className="mt-6">
        <div className="flex items-center gap-2 text-sm text-primary">
          <FacetMark size={16} />
          <span className="font-medium uppercase tracking-wider">Private · End-to-end encrypted</span>
        </div>
        <h1 className="heading-display mt-3 text-balance text-3xl md:text-5xl">
          Secret Chat — private, encrypted, self-destructing
        </h1>
        <p className="mt-4 max-w-3xl text-pretty text-lg text-muted-foreground md:text-xl">
          Spin up a private room, share the link with one person, and chat with text and media.
          Everything is end-to-end encrypted, nothing readable is stored on our side, and the whole
          conversation self-destructs on a timer. No signup.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span>By <Link href="/about" className="font-medium text-foreground hover:underline">{AUTHOR.name}</Link></span>
          {tool.updatedAt && (
            <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />Updated {new Date(tool.updatedAt).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" })}</span>
          )}
        </div>
      </header>

      <div className="mt-8 max-w-xl">
        <CreateChat />
      </div>

      <Section heading="How it works">
        <p>
          When you create a chat, your browser generates a random AES-256 key and places it in the
          link&apos;s <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">#fragment</code> — the
          one part of a URL browsers never transmit to a server. Every message and file is encrypted
          with that key in your browser before it&apos;s sent, so our server only ever relays and
          briefly stores <strong>ciphertext it cannot decrypt</strong>.
        </p>
        <p>
          The person you share the link with opens it, their browser reads the same key from the
          fragment, and messages decrypt locally. We never see the key and never see plaintext —
          there is no point at which a readable copy of your conversation exists on our side.
        </p>
        <p>
          A <strong>server-enforced self-destruct</strong> deletes the session and all its encrypted
          data when the timer expires (or instantly when either person taps Destroy). Because we hold
          no key and keep no plaintext, once it&apos;s gone it&apos;s gone — unrecoverable by anyone,
          including us. Important: the link <em>is</em> the key, so only send it to the person you
          want in the chat.
        </p>
      </Section>

      <Section heading="What people use it for">
        <p>Secret Chat fits any moment you want a conversation that simply doesn&apos;t stick around:</p>
        <ul className="mt-2 space-y-2">
          <li><strong>Send a private link to one person</strong> — share a password, an address, or something personal without it living in a messaging app&apos;s history.</li>
          <li><strong>An anonymous chat with no account</strong> — no sign-up, no phone number, no app; open the page and you&apos;re chatting.</li>
          <li><strong>A disposable group room</strong> — spin up an encrypted group, drop the link (or the Group ID + passphrase) in your team chat, and let it self-destruct when you&apos;re done.</li>
          <li><strong>Self-destructing messages and files</strong> — share an image or document that&apos;s gone on a timer, encrypted end-to-end the whole way.</li>
          <li><strong>A quick, no-install alternative to Telegram/Signal</strong> — when you don&apos;t want anyone signing up for anything just to talk privately once.</li>
        </ul>
      </Section>

      <Section heading="Frequently asked questions">
        <Accordion className="w-full">
          {FAQ.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>

      <Section heading="Related tools">
        <div className="grid gap-4 md:grid-cols-3">
          {relatedTools.map((t) => (
            <ToolCard key={t.slug} tool={t} />
          ))}
        </div>
      </Section>

      <Section heading="Sources & references">
        <ul className="space-y-2 text-base">
          <li><a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-foreground hover:underline">MDN — Web Crypto API (AES-GCM)<ExternalLink className="size-3.5 text-muted-foreground" /></a></li>
          <li><a href="https://developer.mozilla.org/en-US/docs/Web/API/URL/hash" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-foreground hover:underline">MDN — URL fragment (#hash) is not sent to servers<ExternalLink className="size-3.5 text-muted-foreground" /></a></li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">Encryption is AES-GCM-256 via the browser&apos;s native Web Crypto API; the key never leaves your device&apos;s URL fragment.</p>
      </Section>

      <div className="mt-16 rounded-2xl border border-border/60 bg-muted/30 p-6 text-center md:p-8">
        <p className="text-sm text-muted-foreground">Questions or a bug to report?</p>
        <p className="mt-1 font-medium">Email <a href={`mailto:${AUTHOR.email}`} className="text-primary hover:underline">{AUTHOR.email}</a>.</p>
      </div>
    </article>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 md:mt-16">
      <h2 className="heading-section text-2xl md:text-3xl">{heading}</h2>
      <Separator className="my-4" />
      <div className="space-y-4 text-base leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}
