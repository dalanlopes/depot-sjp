import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Role } from "./types";
import { resolveTabs, type Tab } from "./roles";
import { db } from "./db";

const SESSION_COOKIE = "depot_session";
const alg = "HS256";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET não configurada.");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  nome: string;
  email: string;
  role: Role;
  tabs: Tab[];
  podeVerFaturamento: boolean;
  sessionVersion: number;
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Código de uso único (convite / reset) exibido só para o admin, que repassa
// manualmente ao usuário. 8 caracteres alfanuméricos maiúsculos (sem 0/O/1/I
// para evitar confusão ao digitar) — bastante entropia dado que também expira
// e é limitado por rate limit.
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateSetupToken(): string {
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += TOKEN_ALPHABET[crypto.randomInt(TOKEN_ALPHABET.length)];
  }
  return token;
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const p = payload as unknown as SessionPayload;

    // Confere no banco se a sessão ainda é válida: usuário ativo e a versão
    // de sessão bate com a atual. Isso garante que desativar um usuário ou
    // resetar a senha derruba qualquer sessão já emitida na hora seguinte
    // (em vez de só quando o token expirar, até 12h depois).
    const atual = await db
      .selectFrom("users")
      .select(["ativo", "session_version"])
      .where("id", "=", p.userId)
      .executeTakeFirst();

    if (!atual || !atual.ativo) return null;
    if ((p.sessionVersion ?? 1) !== atual.session_version) return null;

    // Sessões antigas (criadas antes das permissões por usuário) não têm
    // "tabs"/"podeVerFaturamento" no token: preenche com o padrão do perfil
    // para não quebrar a interface até o usuário logar de novo.
    return {
      ...p,
      tabs: resolveTabs(p.role, p.tabs),
      podeVerFaturamento: p.podeVerFaturamento ?? false,
      sessionVersion: atual.session_version,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
