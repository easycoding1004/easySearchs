import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { getRecordsForSession } from "@/lib/notion/records";
import { getSessionById } from "@/lib/notion/sessions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await getSessionById(sessionId);
  if (!session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }

  const records = await getRecordsForSession(sessionId);
  const csv = toCsv(records);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        session.title
      )}.csv"`,
    },
  });
}
