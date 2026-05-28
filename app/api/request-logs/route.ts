import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { getRequestLogs, clearRequestLogs } from "@/lib/request-log";

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<IronSessionData>(cookieStore, sessionOptions);
}

export async function GET() {
  const session = await getSession();
  if (!session.apiToken || !session.host) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json(getRequestLogs());
}

export async function DELETE(_req: NextRequest) {
  const session = await getSession();
  if (!session.apiToken || !session.host) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  clearRequestLogs();
  return NextResponse.json({ ok: true });
}
