import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 1800;
const MAX_USERNAME_LENGTH = 80;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const jsonHeaders = { "Content-Type": "application/json" } as const;

const getClientIp = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
};

const parseAllowedOrigins = (envValue: string | undefined): Set<string> => {
  if (!envValue) return new Set();
  return new Set(
    envValue
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
};

const isOriginAllowed = (origin: string | null, allowedOrigins: Set<string>): boolean => {
  if (allowedOrigins.size === 0) return true;
  if (!origin) return false;
  return allowedOrigins.has(origin);
};

const checkRateLimit = (key: string): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return { allowed: false, retryAfter: retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true };
};

export async function POST(request: Request) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500, headers: jsonHeaders },
    );
  }

  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin, allowedOrigins)) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403, headers: jsonHeaders },
    );
  }

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          ...jsonHeaders,
          "Retry-After": String(rateLimit.retryAfter ?? 60),
        },
      },
    );
  }

  let payload: { content?: string; username?: string; avatarUrl?: string } | null = null;
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const content = payload?.content?.trim();
  if (!content) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400, headers: jsonHeaders },
    );
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "Message too long" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const username = payload?.username?.trim();
  if (username && username.length > MAX_USERNAME_LENGTH) {
    return NextResponse.json(
      { error: "Username too long" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const avatarUrl = payload?.avatarUrl?.trim();

  const discordResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      username: username || undefined,
      avatar_url: avatarUrl || undefined,
    }),
  });

  if (!discordResponse.ok) {
    return NextResponse.json(
      { error: "Upstream error" },
      { status: 502, headers: jsonHeaders },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: jsonHeaders });
}
