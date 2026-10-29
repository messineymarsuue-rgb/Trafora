import { bindings } from "./bindings.server";

type UserRow = { id: number; name: string; email: string };
type FullUserRow = UserRow & { password_hash: string; password_salt: string };

const encoder = new TextEncoder();

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function database() {
  const { DB } = bindings();
  if (!DB) throw new Error("DATABASE_NOT_CONFIGURED");
  return DB;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomToken(bytes = 24) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function passwordHash(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: hexToBytes(saltHex), iterations: 120_000, hash: "SHA-256" }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

export async function createUser(name: string, email: string, password: string) {
  const DB = database();
  const salt = randomToken(16);
  const hash = await passwordHash(password, salt);
  const result = await DB.prepare("INSERT INTO trafora_users (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?)")
    .bind(name.trim().slice(0, 60), email.trim().toLowerCase(), hash, salt).run();
  return { id: Number(result.meta.last_row_id), name: name.trim().slice(0, 60), email: email.trim().toLowerCase() };
}

export async function verifyUser(email: string, password: string): Promise<UserRow | null> {
  const user = await database().prepare("SELECT id, name, email, password_hash, password_salt FROM trafora_users WHERE email = ? COLLATE NOCASE")
    .bind(email.trim().toLowerCase()).first<FullUserRow>();
  if (!user) return null;
  const candidate = await passwordHash(password, user.password_salt);
  if (candidate.length !== user.password_hash.length) return null;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i++) mismatch |= candidate.charCodeAt(i) ^ user.password_hash.charCodeAt(i);
  return mismatch === 0 ? { id: user.id, name: user.name, email: user.email } : null;
}

export async function startSession(userId: number) {
  const DB = database();
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  await DB.prepare("INSERT INTO trafora_sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))")
    .bind(tokenHash, userId).run();
  return { token, cookie: `tf_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000` };
}

export function readCookie(request: Request, key: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === key) return rest.join("=");
  }
  return null;
}

export async function currentUser(request: Request): Promise<UserRow | null> {
  const token = readCookie(request, "tf_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  return database().prepare(`SELECT u.id, u.name, u.email FROM trafora_sessions s
    JOIN trafora_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now') LIMIT 1`)
    .bind(tokenHash).first<UserRow>();
}

export async function endSession(request: Request) {
  const token = readCookie(request, "tf_session");
  if (token) await database().prepare("DELETE FROM trafora_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function safeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function shortSlug() {
  return randomToken(5).slice(0, 8);
}
