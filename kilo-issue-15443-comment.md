Corroborating data point from a different code path — same underlying error string, so adding it here rather than filing separately.

I hit the identical `EPROTO: The TLS handshake failed. Does the server speak TLS on this port?` during a CLI/desktop session, but from the **`webfetch` tool** rather than from provider streaming. Reproduced deterministically today (2026-10-24) against sites that reject non-browser clients:

```text
webfetch https://leetcode.com/discuss/post/5994129
  -> EPROTO: The TLS handshake failed. Does the server speak TLS on this port?

webfetch https://medium.com/@garvitjindal09/what-three-rounds-at-goldman-sachs-taught-me-about-how-engineering-interviews-really-work-ddc054f4be83
  -> same error
```

The transport is healthy in both cases — curl completes a TLSv1.3 handshake to those exact URLs and gets a plain `403` with a body:

```bash
curl -s -o /dev/null -w '%{http_code}' --max-time 12 https://leetcode.com/discuss/post/5994129
# 403

curl -sv --max-time 12 https://leetcode.com/discuss/post/5994129 -o /dev/null 2>&1 | grep TLS
# * (304) (IN), TLS handshake, Server hello (2):
# * (304) (IN), TLS handshake, Certificate (11):
# * SSL connection using TLSv1.3 / AEAD-CHACHA20-POLY1305-SHA256
```

At the same moment, `https://api.github.com` and plain documentation sites fetch without error from the same machine, so there is no general TLS/network fault.

Two things this adds to the report:

**1. It is not provider-specific.** The error surfaces from more than one networking path (model streaming in the original report, `webfetch` here), which points at a shared HTTP client/TLS layer rather than something in the DeepSeek integration.

**2. The message is misleading when a response was actually received.** When a server answers with 403/429/451, no TLS failure occurred — the request was *rejected*. The current text implies the user's machine has a TLS misconfiguration, and it gives the agent no way to tell "this host blocks bots" (expected, stop retrying) from "this host/port is wrong" (a real config problem). In my session that caused 2–3 pointless retries per blocked domain, because nothing in the error indicated retrying was futile.

Suggested refinements, in case they're useful for the fix:

- If any HTTP response was received, surface the **status code** instead of a TLS error.
- Include the attempted `host:port` in every transport-level message.
- If a connection is genuinely reset mid-handshake, say so distinctly, e.g. `Connection reset by peer during TLS handshake with leetcode.com:443`.
- Optionally expose a separate error code for "blocked by remote" so callers can branch without string matching.

Environment for this data point: macOS (Apple Silicon), Kilo CLI/desktop session, 2026-10-24.
