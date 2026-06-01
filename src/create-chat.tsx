"use client";

import * as React from "react";
import { Loader2, ShieldCheck, User, Users, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateKey, randomPassphrase } from "@/lib/secret-chat/crypto";

const EXPIRIES = [
  { v: "1h", label: "1 hour" },
  { v: "8h", label: "8 hours" },
  { v: "24h", label: "24 hours" },
  { v: "7d", label: "1 week" },
  { v: "30d", label: "1 month" },
  { v: "never", label: "Never" },
] as const;

type Tab = "direct" | "group" | "join";

export function CreateChat() {
  const [tab, setTab] = React.useState<Tab>("direct");
  const [expiry, setExpiry] = React.useState<string>("24h");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [joinId, setJoinId] = React.useState("");
  const [joinPass, setJoinPass] = React.useState("");

  async function createDirect() {
    setBusy(true); setError("");
    try {
      const { fragment } = await generateKey();
      const res = await fetch("/api/secret-chat/create", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiry, mode: "direct" }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? "Could not create the chat."); setBusy(false); return; }
      window.location.href = `/tools/secret-chat/${data.id}#${fragment}`;
    } catch { setError("Network error — please try again."); setBusy(false); }
  }

  async function createGroup() {
    setBusy(true); setError("");
    try {
      const passphrase = randomPassphrase();
      const res = await fetch("/api/secret-chat/create", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expiry, mode: "group" }),
      });
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? "Could not create the group."); setBusy(false); return; }
      window.location.href = `/tools/secret-chat/${data.id}#g=${encodeURIComponent(passphrase)}`;
    } catch { setError("Network error — please try again."); setBusy(false); }
  }

  function joinGroup() {
    const id = joinId.trim();
    const pass = joinPass.trim();
    if (!id || !pass) { setError("Enter both the Group ID and passphrase."); return; }
    window.location.href = `/tools/secret-chat/${encodeURIComponent(id)}#g=${encodeURIComponent(pass)}`;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 md:p-6">
      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="size-4" />
        <span className="font-medium">End-to-end encrypted · nothing readable is stored</span>
      </div>

      {/* Tabs */}
      <div className="mt-4 grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1 text-sm">
        {([["direct", "1-to-1", User], ["group", "Group", Users], ["join", "Join", LogIn]] as const).map(([t, label, Icon]) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); }}
            className={
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-medium transition-colors " +
              (tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="size-3.5" />{label}
          </button>
        ))}
      </div>

      {tab !== "join" ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {tab === "direct"
              ? "A private 1-to-1 chat. Share the link with one person — the encryption key lives only in the link."
              : "A group anyone can join with the link (or the Group ID + passphrase). Each person picks a name and photo, like Telegram."}
          </p>
          <div className="mt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Auto-destruct after</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPIRIES.map((e) => (
                <button
                  key={e.v}
                  onClick={() => setExpiry(e.v)}
                  className={
                    "rounded-full border px-3 py-1 text-sm " +
                    (expiry === e.v ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/60")
                  }
                >
                  {e.label}
                </button>
              ))}
            </div>
            {expiry === "never" && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Heads up: &quot;Never&quot; keeps the encrypted chat until someone destroys it. For true privacy, prefer a timer.</p>}
          </div>
          <Button onClick={tab === "direct" ? createDirect : createGroup} disabled={busy} className="mt-5 gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {tab === "direct" ? "Create secret chat" : "Create group chat"}
          </Button>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">Join an existing group with its Group ID and passphrase (the person who made it can share these).</p>
          <div className="mt-4 space-y-2">
            <input value={joinId} onChange={(e) => setJoinId(e.target.value)} placeholder="Group ID" className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <input value={joinPass} onChange={(e) => setJoinPass(e.target.value)} placeholder="Passphrase" className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <Button onClick={joinGroup} className="mt-4 gap-2"><LogIn className="size-4" /> Join group</Button>
        </>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
