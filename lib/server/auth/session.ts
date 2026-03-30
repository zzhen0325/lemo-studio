import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { HttpError } from '@/lib/server/utils/http-error';

const SESSION_COOKIE_NAME = 'lemo_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface SessionActor {
  actorId: string;
  userId: string | null;
  isGuest: boolean;
  expiresAt: number;
}

export interface SessionResolution {
  session: SessionActor;
  shouldSetCookie: boolean;
}

function getSessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET?.trim()
    || process.env.API_CONFIG_ENCRYPTION_KEY?.trim()
    || process.env.COZE_SUPABASE_ANON_KEY?.trim()
    || 'lemo-studio-development-session-secret'
  );
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

function encodeSession(session: SessionActor): string {
  const payload = JSON.stringify(session);
  return `${toBase64Url(payload)}.${signPayload(payload)}`;
}

function decodeSession(value: string): SessionActor | null {
  const [payloadPart, signaturePart] = value.split('.');
  if (!payloadPart || !signaturePart) {
    return null;
  }

  try {
    const payload = fromBase64Url(payloadPart);
    const expectedSignature = signPayload(payload);
    const provided = Buffer.from(signaturePart, 'utf8');
    const expected = Buffer.from(expectedSignature, 'utf8');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return null;
    }

    const parsed = JSON.parse(payload) as Partial<SessionActor>;
    if (!parsed || typeof parsed.actorId !== 'string' || typeof parsed.expiresAt !== 'number' || typeof parsed.isGuest !== 'boolean') {
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      return null;
    }

    return {
      actorId: parsed.actorId,
      userId: typeof parsed.userId === 'string' ? parsed.userId : null,
      isGuest: parsed.isGuest,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function createGuestSession(): SessionActor {
  return {
    actorId: randomUUID(),
    userId: null,
    isGuest: true,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

export function createAuthenticatedSession(userId: string): SessionActor {
  return {
    actorId: userId,
    userId,
    isGuest: false,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

export async function getSession(): Promise<SessionActor | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  return decodeSession(raw);
}

export async function getOrCreateSession(): Promise<SessionResolution> {
  const existing = await getSession();
  if (existing) {
    const shouldRefresh = existing.expiresAt - Date.now() < SESSION_REFRESH_THRESHOLD_MS;
    return {
      session: shouldRefresh ? { ...existing, expiresAt: Date.now() + SESSION_TTL_MS } : existing,
      shouldSetCookie: shouldRefresh,
    };
  }

  return {
    session: createGuestSession(),
    shouldSetCookie: true,
  };
}

export async function requireSession(options?: { allowGuest?: boolean }): Promise<SessionResolution> {
  const resolution = await getOrCreateSession();
  if (!options?.allowGuest && resolution.session.isGuest) {
    throw new HttpError(401, 'Authentication required');
  }
  return resolution;
}

export function attachSessionCookie<T extends NextResponse>(response: T, session: SessionActor): T {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSession(session),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(session.expiresAt),
  });
  return response;
}

export function clearSessionCookie<T extends NextResponse>(response: T): T {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
