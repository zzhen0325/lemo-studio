import { attachSessionCookie, createAuthenticatedSession, createGuestSession, getOrCreateSession, requireSession } from '@/lib/server/auth/session';
import { getServerServices } from '@/lib/server/container';
import { errorResponse, jsonResponse, readJsonBody } from '@/lib/server/http';
import { HttpError } from '@/lib/server/utils/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function buildSessionResponse(actorId: string, isGuest: boolean, user: Record<string, unknown> | null) {
  return {
    session: {
      actorId,
      isGuest,
      user,
    },
  };
}

export async function GET() {
  try {
    const { usersService } = await getServerServices();
    const resolution = await getOrCreateSession();
    const user = resolution.session.userId
      ? await usersService.getUserById(resolution.session.userId)
      : null;

    const response = jsonResponse(buildSessionResponse(
      resolution.session.actorId,
      resolution.session.isGuest,
      user,
    ));

    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { usersService, historyService, infiniteCanvasService } = await getServerServices();
    const body = await readJsonBody<{ action?: string; username?: string; password?: string }>(request);
    const resolution = await getOrCreateSession();

    let user: Record<string, unknown>;
    if (body.action === 'register') {
      user = await usersService.register(body);
    } else if (body.action === 'login') {
      user = await usersService.login(body);
    } else {
      throw new HttpError(400, 'Invalid action');
    }

    const userId = typeof user.id === 'string' ? user.id : '';
    const session = createAuthenticatedSession(userId);

    if (resolution.session.isGuest && resolution.session.actorId !== userId) {
      await historyService.reassignHistoryOwner(resolution.session.actorId, userId);
      await infiniteCanvasService.reassignProjectOwner(resolution.session.actorId, userId);
    }

    const response = jsonResponse(buildSessionResponse(session.actorId, false, user));
    attachSessionCookie(response, session);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { usersService } = await getServerServices();
    const resolution = await requireSession();
    const user = await usersService.updateUser(
      resolution.session.userId as string,
      await readJsonBody(request),
    );
    const response = jsonResponse(buildSessionResponse(
      resolution.session.actorId,
      false,
      user,
    ));
    if (resolution.shouldSetCookie) {
      attachSessionCookie(response, resolution.session);
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const guestSession = createGuestSession();
    const response = jsonResponse(buildSessionResponse(guestSession.actorId, true, null));
    attachSessionCookie(response, guestSession);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
