import { jsonResponse } from '@/lib/server/http';

// Retired: the old implementation replaced complete URLs with a fixed prefix.
// Keep an explicit response for stale callers without touching the database.
function retiredResponse() {
  return jsonResponse({ error: 'This URL repair endpoint has been retired' }, { status: 410 });
}

export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}
