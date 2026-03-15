import { NextRequest } from 'next/server';
import { getServerServices } from '@/lib/server/container';
import { handleRoute, queryValue, readJsonBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return handleRoute(async () => {
    const { usersService } = await getServerServices();
    return usersService.getUsers(queryValue(request, 'id'));
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { usersService } = await getServerServices();
    return usersService.handlePost(await readJsonBody(request));
  });
}

export async function PUT(request: Request) {
  return handleRoute(async () => {
    const { usersService } = await getServerServices();
    return usersService.updateUser(await readJsonBody(request));
  });
}
