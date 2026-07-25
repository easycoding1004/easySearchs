import { NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
