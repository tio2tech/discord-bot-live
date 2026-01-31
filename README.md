# discord-bot-live
Tio₂ Live Discord Bridge: a secure web chat widget that streams a Discord channel to your website in real time and lets visitors send messages safely via a server-side bot (SSE). Includes futuristic UI, message history, and basic anti-abuse hooks.

## Website Message Bot setup

### Relevant files
- `app/api/webhook-proxy/route.ts`
- `public/embed/widget.html`

### Environment variables
- `DISCORD_WEBHOOK_URL`: Discord webhook URL used by the server proxy.
- `ALLOWED_ORIGINS`: Optional comma-separated list of allowed origins (e.g., `https://example.com,https://www.example.com`).

### Deploy checklist (Vercel)
1. Add the environment variables above in the Vercel project settings.
2. Deploy the Next.js app.
3. Embed the widget from `/public/embed/widget.html` or copy its HTML into your site.

###
[![Deploy with Vercel](https://vercel.com/button)](
https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/vercel-discord-webhook-proxy
)

### Local testing
- Start the Next.js dev server and use curl:
  ```bash
  curl -X POST http://localhost:3000/api/webhook-proxy \
    -H "Content-Type: application/json" \
    -d '{"content":"Hello from local test","username":"Website Bot"}'
  ```
- Open `/public/embed/widget.html` in the browser and submit a message.

### Security notes and optional hardening
- The proxy blocks unknown origins if `ALLOWED_ORIGINS` is set.
- Rate limiting is in-memory per IP; use Redis (e.g., Upstash) for stronger limits.
- Consider adding a CAPTCHA (e.g., Turnstile) to the widget to reduce abuse.

### User-editable config
Edit these values in `public/embed/widget.html`:
- `PROXY_URL`: The proxy endpoint URL.
- `BOT_NAME`: The display name posted to Discord.
- `AVATAR_URL`: Optional avatar URL for the Discord message.
- `RATE_LIMIT_MS`: Client-side throttle duration.

Edit these constants in `app/api/webhook-proxy/route.ts`:
- `MAX_MESSAGE_LENGTH`: Max message length.
- `RATE_LIMIT_WINDOW_MS`: Rate limit window.
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window.
