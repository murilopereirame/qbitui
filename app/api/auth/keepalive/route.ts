import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);

  if (!session.sid || !session.host) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const api = new QBitAPI(session.host, session.sid);
    const alive = await api.verifyAuth();

    if (!alive) {
      return NextResponse.json({ error: "Session expired" }, { status: 403 });
    }

    return NextResponse.json({ alive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Keepalive check failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
