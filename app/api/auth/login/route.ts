import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { verifyApiToken } from "@/lib/qbit-api";

export async function POST(req: NextRequest) {
  try {
    const { host, apiToken } = await req.json();

    if (!host || !apiToken) {
      return NextResponse.json({ error: "Host and API token are required" }, { status: 400 });
    }

    const resolvedHost = await verifyApiToken(host, apiToken);

    const cookieStore = await cookies();
    const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
    session.host = resolvedHost;
    session.apiToken = apiToken;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
