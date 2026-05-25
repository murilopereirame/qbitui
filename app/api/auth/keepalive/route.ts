import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);

  if (!session.apiToken || !session.host) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const api = new QBitAPI(session.host, session.apiToken);
    const alive = await api.verifyAuth();

    if (!alive) {
      return NextResponse.json({ error: "Cannot reach qBittorrent server" }, { status: 502 });
    }

    return NextResponse.json({ alive: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connectivity check failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
