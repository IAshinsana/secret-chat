"use client";

import * as React from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Send, Paperclip, Copy, Check, ShieldCheck, Trash2, Timer, Users, QrCode as QrIcon, Download, ArrowLeft, Smile, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  importKeyFromFragment,
  deriveKeyFromPassphrase,
  encryptText,
  decryptText,
  encryptBytes,
  decryptBytes,
} from "@/lib/secret-chat/crypto";

interface Msg {
  seq: number;
  sender: string;
  ts: number;
  username: string;
  avatarId: string | null;
  kind: "text" | "media" | "system";
  text?: string;
  media?: { name: string; mime: string; mediaKind: "image" | "file"; mediaId: string };
}
type Status = "loading" | "prejoin" | "active" | "ended" | "error" | "full";
interface Identity { participant: string; username: string; avatarId: string | null }

const MAX_MEDIA = 3 * 1024 * 1024;
const EMOJIS = "😀 😂 🥰 😍 😎 🤔 😅 😭 😡 👍 👎 🙏 👏 🙌 💪 🔥 ✨ 🎉 ❤️ 💔 💯 ✅ ❌ ⚠️ 👀 🤝 🫡 🤯 😴 🥳 😇 🤩 😬 🙄 😏 🥺 😤 🤗 👋 🤙 🫶 💀 👻 🚀 ⭐ 🌟 💡 📌 📎 🔒 🔑 ⏰ 📷 🎵 ☕ 🍕".split(" ");

function colorFor(name: string): string {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const colors = ["#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f43f5e"];
  return colors[h % colors.length]!;
}

export function ChatRoom({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [mode, setMode] = React.useState<"direct" | "group">("direct");
  const [identity, setIdentity] = React.useState<Identity | null>(null);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState(0);
  const [neverExpires, setNeverExpires] = React.useState(false);
  const [participants, setParticipants] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [qr, setQr] = React.useState("");
  const [showQr, setShowQr] = React.useState(false);
  const [showEmoji, setShowEmoji] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [vh, setVh] = React.useState<number | null>(null);
  const [vTop, setVTop] = React.useState(0);

  // prejoin form
  const [nameInput, setNameInput] = React.useState("");
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [joining, setJoining] = React.useState(false);

  const keyRef = React.useRef<CryptoKey | null>(null);
  const identityRef = React.useRef<Identity | null>(null);
  const lastSeqRef = React.useRef(0);
  const pollingRef = React.useRef(false);
  const mediaCache = React.useRef<Map<string, string>>(new Map());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  function resolveKey(): Promise<CryptoKey> {
    const frag = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (frag.startsWith("g=")) return deriveKeyFromPassphrase(frag.slice(2), sessionId);
    return importKeyFromFragment(frag);
  }

  // Init: learn mode + key; resume or show pre-join (group) / auto-join (direct).
  React.useEffect(() => {
    const frag = window.location.hash;
    if (!frag || frag.length < 4) { setStatus("error"); return; }
    let cancelled = false;
    (async () => {
      try {
        keyRef.current = await resolveKey();
        const meta = await (await fetch(`/api/secret-chat/${sessionId}?since=0`)).json();
        if (!meta.alive) { if (!cancelled) setStatus("ended"); return; }
        if (cancelled) return;
        setMode(meta.mode === "group" ? "group" : "direct");
        QRCode.toDataURL(window.location.href, { width: 200, margin: 1 }).then((u) => !cancelled && setQr(u)).catch(() => {});

        const saved = sessionStorage.getItem(`sc:${sessionId}`);
        if (saved) {
          const id = JSON.parse(saved) as Identity;
          identityRef.current = id; setIdentity(id);
          if (!cancelled) setStatus("active");
          return;
        }
        if (meta.mode === "group") {
          if (!cancelled) setStatus("prejoin");
        } else {
          // direct: auto-join, no name needed
          const r = await (await fetch(`/api/secret-chat/${sessionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join" }) })).json();
          if (!r.ok) { if (!cancelled) setStatus(r.error === "full" ? "full" : "ended"); return; }
          const id: Identity = { participant: r.participant, username: "", avatarId: null };
          sessionStorage.setItem(`sc:${sessionId}`, JSON.stringify(id));
          identityRef.current = id; setIdentity(id);
          if (!cancelled) setStatus("active");
        }
      } catch { if (!cancelled) setStatus("error"); }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Poll.
  React.useEffect(() => {
    if (status !== "active") return;
    let stop = false;
    const poll = async () => {
      // Guard against overlapping runs: an in-flight poll that outlasts the
      // 2s interval would otherwise re-fetch the same `since` and append the
      // same messages again, rendering each message multiple times.
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const data = await (await fetch(`/api/secret-chat/${sessionId}?since=${lastSeqRef.current}`)).json();
        if (!data.alive) { setStatus("ended"); return; }
        setExpiresAt(data.expires_at); setParticipants(data.participant_count); setNeverExpires(!!data.never_expires);
        if (data.messages?.length && keyRef.current) {
          const decoded: Msg[] = [];
          for (const m of data.messages) {
            lastSeqRef.current = Math.max(lastSeqRef.current, m.seq);
            try {
              const raw = await decryptText(keyRef.current, m.iv, m.ciphertext);
              let env: { u?: string; a?: string | null; k?: string; t?: string; m?: Msg["media"] };
              try { env = JSON.parse(raw); } catch { env = { k: "text", t: raw }; }
              decoded.push({
                seq: m.seq, sender: m.sender, ts: m.created_at,
                username: env.u ?? "Anonymous", avatarId: env.a ?? null,
                kind: (env.k as Msg["kind"]) ?? "text", text: env.t, media: env.m,
              });
            } catch { /* skip undecryptable */ }
          }
          // Dedupe by seq so a message can never be appended twice, even if a
          // duplicate slips through (overlapping fetch, retry, etc.).
          if (decoded.length) setMessages((p) => {
            const seen = new Set(p.map((x) => x.seq));
            const fresh = decoded.filter((d) => !seen.has(d.seq));
            return fresh.length ? [...p, ...fresh] : p;
          });
        }
      } catch { /* transient */ } finally { pollingRef.current = false; }
    };
    poll();
    const id = setInterval(() => { if (!stop) poll(); }, 2000);
    return () => { stop = true; clearInterval(id); };
  }, [status, sessionId]);

  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  React.useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    // Size AND position the overlay to the *visual* viewport. When the mobile
    // keyboard opens, the visual viewport shrinks (height) and can pan down
    // (offsetTop); translating by offsetTop keeps the overlay glued to the
    // visible area so the page/footer behind it never leaks into the gap.
    const apply = () => {
      setVh(vv ? vv.height : window.innerHeight);
      setVTop(vv ? vv.offsetTop : 0);
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      document.body.style.overflow = prev;
    };
  }, []);

  React.useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  async function makeAvatarBytes(file: File): Promise<ArrayBuffer> {
    const bmp = await createImageBitmap(file);
    const size = 96;
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const ctx = c.getContext("2d")!;
    const scale = Math.max(size / bmp.width, size / bmp.height);
    const w = bmp.width * scale, h = bmp.height * scale;
    ctx.drawImage(bmp, (size - w) / 2, (size - h) / 2, w, h);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob!.arrayBuffer();
  }

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  }

  async function joinGroup() {
    const username = nameInput.trim().slice(0, 24) || "Anonymous";
    if (!keyRef.current) return;
    setJoining(true);
    try {
      let avatarId: string | null = null;
      if (avatarFile) {
        const enc = await encryptBytes(keyRef.current, await makeAvatarBytes(avatarFile));
        const up = await (await fetch(`/api/secret-chat/${sessionId}/media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ iv: enc.iv, ciphertext: enc.ct, mime: "image" }) })).json();
        if (up.ok) avatarId = up.mediaId;
      }
      const r = await (await fetch(`/api/secret-chat/${sessionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join" }) })).json();
      if (!r.ok) { setStatus(r.error === "full" ? "full" : "ended"); return; }
      const id: Identity = { participant: r.participant, username, avatarId };
      sessionStorage.setItem(`sc:${sessionId}`, JSON.stringify(id));
      identityRef.current = id; setIdentity(id);
      setStatus("active");
    } catch { setStatus("error"); } finally { setJoining(false); }
  }

  async function sendText() {
    const text = input.trim();
    if (!text || !keyRef.current || !identityRef.current || status !== "active") return;
    setInput(""); setShowEmoji(false);
    const env = JSON.stringify({ u: identityRef.current.username, a: identityRef.current.avatarId, k: "text", t: text });
    const { iv, ct } = await encryptText(keyRef.current, env);
    await fetch(`/api/secret-chat/${sessionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", sender: identityRef.current.participant, kind: "text", iv, ciphertext: ct }) });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !keyRef.current || !identityRef.current) return;
    if (file.size > MAX_MEDIA) { alert("Files must be 3 MB or smaller."); return; }
    const enc = await encryptBytes(keyRef.current, await file.arrayBuffer());
    const up = await (await fetch(`/api/secret-chat/${sessionId}/media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ iv: enc.iv, ciphertext: enc.ct, mime: file.type.startsWith("image/") ? "image" : "file" }) })).json();
    if (!up.ok) { alert(up.error ?? "Upload failed."); return; }
    const media = { name: file.name, mime: file.type, mediaKind: file.type.startsWith("image/") ? "image" : "file", mediaId: up.mediaId };
    const env = JSON.stringify({ u: identityRef.current.username, a: identityRef.current.avatarId, k: "media", m: media });
    const { iv, ct } = await encryptText(keyRef.current, env);
    await fetch(`/api/secret-chat/${sessionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", sender: identityRef.current.participant, kind: "media", iv, ciphertext: ct, mediaId: up.mediaId }) });
  }

  const loadMedia = React.useCallback(async (mediaId: string): Promise<string | null> => {
    if (mediaCache.current.has(mediaId)) return mediaCache.current.get(mediaId)!;
    if (!keyRef.current) return null;
    const data = await (await fetch(`/api/secret-chat/${sessionId}/media/${mediaId}`)).json();
    if (!data.ok) return null;
    const buf = await decryptBytes(keyRef.current, data.iv, data.ciphertext);
    const url = URL.createObjectURL(new Blob([buf]));
    mediaCache.current.set(mediaId, url);
    return url;
  }, [sessionId]);

  async function destroy() {
    if (!confirm("Destroy this chat for everyone now? This can't be undone.")) return;
    await fetch(`/api/secret-chat/${sessionId}`, { method: "DELETE" });
    sessionStorage.removeItem(`sc:${sessionId}`);
    setStatus("ended");
  }
  function copyLink() { navigator.clipboard.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }

  const heightStyle = {
    height: vh ? `${vh}px` : "100dvh",
    transform: vTop ? `translateY(${vTop}px)` : undefined,
  } as React.CSSProperties;

  if (status === "loading") return <FullScreen style={heightStyle}><Centered>Connecting securely…</Centered></FullScreen>;
  if (status === "error") return <FullScreen style={heightStyle}><Centered>This link is incomplete or invalid. A chat link must include the part after <code className="mx-1 font-mono">#</code>.</Centered></FullScreen>;
  if (status === "full") return <FullScreen style={heightStyle}><Centered>This chat is already full.</Centered></FullScreen>;
  if (status === "ended") return <FullScreen style={heightStyle}><Centered>This chat has ended and been destroyed. Nothing was kept.</Centered></FullScreen>;

  // Pre-join (group): choose name + photo.
  if (status === "prejoin") {
    return (
      <FullScreen style={heightStyle}>
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 text-center">
            <ShieldCheck className="mx-auto size-7 text-emerald-600 dark:text-emerald-400" />
            <h2 className="mt-2 text-lg font-semibold">Join the group</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick a name and photo to chat as. Everything stays end-to-end encrypted.</p>
            <button onClick={() => avatarInputRef.current?.click()} className="relative mx-auto mt-5 flex size-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted">
              {avatarPreview ? <img src={avatarPreview} alt="" className="size-full object-cover" /> : <Camera className="size-6 text-muted-foreground" />}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
            <p className="mt-1 text-xs text-muted-foreground">Photo optional</p>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void joinGroup(); }}
              placeholder="Your name"
              maxLength={24}
              className="mt-4 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-center text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button onClick={() => void joinGroup()} disabled={joining || !nameInput.trim()} className="mt-4 w-full gap-2">
              {joining ? "Joining…" : "Join chat"}
            </Button>
          </div>
        </div>
      </FullScreen>
    );
  }

  const remaining = expiresAt ? Math.max(0, expiresAt - now) : 0;
  const days = Math.floor(remaining / 86_400_000);
  const hrs = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  const timeLeft = neverExpires ? "∞" : expiresAt ? (days > 0 ? `${days}d ${hrs}h` : hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs}s`) : "—";
  const isGroup = mode === "group";
  const myId = identity?.participant ?? "";

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex flex-col bg-background" style={heightStyle}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/tools/secret-chat" aria-label="Back" className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-5" /></Link>
          <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate text-sm font-medium">{isGroup ? "Group · Encrypted" : "Encrypted"}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="size-3.5" />{isGroup ? participants : `${participants}/2`}</span>
          <span className="flex items-center gap-1 tabular-nums"><Timer className="size-3.5" />{timeLeft}</span>
          <button onClick={() => setShowQr((v) => !v)} className="hover:text-foreground" aria-label="Show QR"><QrIcon className="size-4" /></button>
          <button onClick={destroy} className="text-red-500 hover:text-red-600" aria-label="Destroy chat"><Trash2 className="size-4" /></button>
        </div>
      </div>

      {/* Share bar */}
      {((isGroup && participants < 2) || (!isGroup && participants < 2)) && (
        <div className="shrink-0 border-b border-border/60 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-medium">{isGroup ? "Invite people to the group" : "Waiting for someone to join…"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Share the link (or Group ID + passphrase). Anyone with it can read the chat.</p>
          <div className="mt-2 flex items-center gap-2">
            <Button onClick={copyLink} size="sm" variant="outline" className="h-8 gap-1.5">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy link"}
            </Button>
            {isGroup && <span className="font-mono text-xs text-muted-foreground">ID: {sessionId}</span>}
          </div>
          {showQr && qr && <img src={qr} alt="Chat link QR code" className="mt-3 size-44 rounded-lg border border-border/60 bg-white p-1" />}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3 py-4">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Say hello — it&apos;s encrypted end-to-end.</p>}
        {messages.map((m, i) => {
          const mine = m.sender === myId;
          const prev = messages[i - 1];
          const showHead = isGroup && !mine && (!prev || prev.sender !== m.sender);
          return (
            <div key={m.seq} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
              {isGroup && !mine && (
                <div className="w-7 shrink-0">{showHead && <Avatar username={m.username} avatarId={m.avatarId} load={loadMedia} />}</div>
              )}
              <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {showHead && <p className="mb-0.5 text-xs font-semibold" style={{ color: colorFor(m.username) }}>{m.username}</p>}
                {m.kind === "media" && m.media ? <MediaBubble media={m.media} load={loadMedia} /> : <span className="whitespace-pre-wrap break-words">{m.text}</span>}
                <span className={cn("ml-2 align-bottom text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Emoji panel */}
      {showEmoji && (
        <div className="shrink-0 border-t border-border/60 bg-muted/30 px-2 py-2">
          <div className="flex max-h-28 flex-wrap gap-0.5 overflow-y-auto">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setInput((v) => v + e)} className="rounded p-1 text-xl hover:bg-muted">{e}</button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex shrink-0 items-center gap-1.5 border-t border-border/60 bg-muted/30 px-2 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} accept="image/*,application/pdf,.txt,.zip" />
        <Button onClick={() => setShowEmoji((v) => !v)} variant="ghost" size="sm" className="size-9 shrink-0 p-0" aria-label="Emoji"><Smile className="size-5" /></Button>
        <Button onClick={() => fileRef.current?.click()} variant="ghost" size="sm" className="size-9 shrink-0 p-0" aria-label="Attach"><Paperclip className="size-4" /></Button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendText(); } }}
          onFocus={() => setShowEmoji(false)}
          placeholder="Type a message…"
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-full border border-border/60 bg-background px-4 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={() => void sendText()} size="sm" className="size-9 shrink-0 rounded-full p-0" aria-label="Send"><Send className="size-4" /></Button>
      </div>
    </div>
  );
}

function FullScreen({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="fixed inset-x-0 top-0 z-[70] flex flex-col bg-background" style={style ?? { height: "100dvh" }}>{children}</div>;
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground"><p className="max-w-md">{children}</p></div>;
}

function Avatar({ username, avatarId, load }: { username: string; avatarId: string | null; load: (id: string) => Promise<string | null> }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => { let a = true; if (avatarId) load(avatarId).then((u) => a && setUrl(u)); return () => { a = false; }; }, [avatarId, load]);
  if (url) return <img src={url} alt={username} className="size-7 rounded-full object-cover" />;
  return <span className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: colorFor(username) }}>{(username[0] ?? "?").toUpperCase()}</span>;
}

function MediaBubble({ media, load }: { media: { name: string; mediaKind: string; mediaId: string }; load: (id: string) => Promise<string | null> }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { let a = true; load(media.mediaId).then((u) => { if (a) { if (u) setUrl(u); else setFailed(true); } }); return () => { a = false; }; }, [media.mediaId, load]);
  if (failed) return <span className="text-xs italic opacity-70">[media expired]</span>;
  if (!url) return <span className="text-xs italic opacity-70">decrypting…</span>;
  if (media.mediaKind === "image") return <img src={url} alt={media.name} className="max-h-64 rounded-lg" />;
  return <a href={url} download={media.name} className="inline-flex items-center gap-1.5 underline"><Download className="size-3.5" /> {media.name}</a>;
}
