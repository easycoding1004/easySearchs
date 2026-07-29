import { NextResponse } from "next/server";
import { clearSession } from "@/lib/notion/users";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/write/auth";
import { getErrorMessage } from "@/lib/utils/errors";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);

  try {
    const user = await getCurrentUser();
    if (user) await clearSession(user.pageId);
  } catch (err) {
    // Cookie is already cleared client-side either way — don't fail the
    // logout over a best-effort server-side session invalidation.
    console.error("[POST /api/auth/logout] clearSession failed:", getErrorMessage(err), err);
  }

  return response;
}
