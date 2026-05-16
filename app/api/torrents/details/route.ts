import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
    if (!session.sid || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const hash = new URL(req.url).searchParams.get("hash");
    if (!hash) {
      return NextResponse.json({ error: "Hash is required" }, { status: 400 });
    }

    const api = new QBitAPI(session.host, session.sid);
    const [properties, trackers, peers, webSeeds, files] = await Promise.all([
      api.getTorrentProperties(hash),
      api.getTorrentTrackers(hash),
      api.getTorrentPeers(hash),
      api.getTorrentWebSeeds(hash),
      api.getTorrentFiles(hash),
    ]);

    return NextResponse.json({ properties, trackers, peers, webSeeds, files });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
