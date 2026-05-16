import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { qbitLogin, validateHost } from "@/lib/qbit-api";

export async function POST(req: NextRequest) {
  try {
    const { host, username, password } = await req.json();

    if (!host || !username || !password) {
      return NextResponse.json({ error: "Host, username and password are required" }, { status: 400 });
    }

    const normalizedHost = validateHost(host);

    const { sid, host: resolvedHost } = await qbitLogin(normalizedHost, username, password);

    const cookieStore = await cookies();
    const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
    session.host = resolvedHost;
    session.sid = sid;
    session.username = username;
    await session.save();

    return NextResponse.json({ success: true, username });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
