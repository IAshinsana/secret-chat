# Secret Chat — E2EE, Self-Destructing Chat

> Reference implementation. Live version: **https://induwara.lk/tools/secret-chat**

Create an end-to-end encrypted chat, share the link, and message privately
with text + media. Nothing readable is stored — the key lives in your link —
and the chat self-destructs on a timer.

## What makes this different

Most "encrypted chat" services hold the key on their server. We don't, by design:

1. **A random AES-256 key is generated in your browser** when you create a chat.
2. The key is placed in the part of the URL after the `#` (the URL **fragment**),
   which **browsers never transmit to any server**.
3. Every message and file is encrypted with that key **before** it leaves your
   device. Our server only ever stores opaque ciphertext it has no key for.
4. A **server-enforced self-destruct timer** wipes the encrypted blob — even
   if no one reads it, it disappears within the window.

The link IS the key. Anyone with the full URL can decrypt the conversation
once; that's the whole security model, and it's deliberate.

## Stack

- **Frontend:** React + Next.js (App Router) + Tailwind CSS + shadcn/base-ui
- **Crypto:** Browser's native [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
  (AES-GCM-256). No external crypto libraries; nothing to audit beyond what
  the browser already ships.
- **Backend:** Next.js API routes + SQLite (better-sqlite3) for ciphertext-only
  session storage with TTL-based purge.
- **Transport:** Polling at 2s intervals (chosen for simplicity over websockets
  — works behind any proxy, no special infra).

## Architecture, in one diagram

```
Browser A                Server                Browser B
─────────                ──────                ─────────
generate AES-256 key →
encrypt(text, key) →
send ciphertext  ─────→  store ciphertext
                         (cannot decrypt)
                                              ←── poll for new
                                              decrypt(ciphertext, key)
                                              display plaintext

                          purgeExpired()
                          on timer
```

## Key files in this repo

- `src/crypto.ts` — Web Crypto wrappers: `generateKey`, `importKeyFromFragment`,
  `encryptText`/`decryptText`, `encryptBytes`/`decryptBytes`,
  `deriveKeyFromPassphrase` (PBKDF2-based, for group-chat passphrase mode).
- `src/chat-room.tsx` — The main chat UI (text + media + group-chat support).
  Highlights worth studying: `pollingRef` overlap-guard to prevent duplicate
  appends, and `visualViewport` + `translateY(offsetTop)` for iOS keyboard
  layout stability.
- `src/create-chat.tsx` — The "create or join" composer with passphrase mode.

## Use it

Live: [induwara.lk/tools/secret-chat](https://induwara.lk/tools/secret-chat)

## Reuse

MIT licensed. Take what's useful — the crypto wrappers are particularly clean.

## Caveats (read these)

- The link is the key. If you paste it somewhere public (Slack channel, GitHub
  issue, screenshot in a tweet), anyone who sees it can read the chat once.
- This is for short, disposable conversations. For long-term private messaging
  with proper identity verification, use [Signal](https://signal.org/).
- 3 MB file-size cap. Larger files would need chunking + resumable upload,
  which adds complexity I haven't built.

## Related

- [induwara.lk/tools/one-time-secret](https://induwara.lk/tools/one-time-secret) — same model, optimised for one-shot password sharing.
- [induwara.lk/tools/secret-file](https://induwara.lk/tools/secret-file) — same model, file-only.
