import { NextResponse } from "next/server";

// Lightweight liveness check for platform health probes (Railway/Render/
// Fly.io/etc.) — deliberately does not touch Notion or Naver so it stays
// fast and doesn't burn API quota on every probe interval.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
