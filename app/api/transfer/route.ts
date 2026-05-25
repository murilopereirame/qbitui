import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const api = new QBitAPI(session.host, session.apiToken);
    const info = await api.getTransferInfo();
    return NextResponse.json(info);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch transfer info";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
