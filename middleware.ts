import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Lightweight middleware — only counts page views.
 *
 * API call counting is handled server-side via the `recordApiCall()`
 * helper imported by each API route, which avoids Edge↔Node boundary
 * issues with database access.
 */

export function middleware(_request: NextRequest) {
  // Page view tracking is done client-side via /api/stats?action=page_view
  // to avoid Edge Runtime database access limitations.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt).*)'],
};
