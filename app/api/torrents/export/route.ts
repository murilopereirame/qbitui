import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const hash = url.searchParams.get("hash");
    const name = url.searchParams.get("name");
    if (!hash) {
      return NextResponse.json({ error: "Hash is required" }, { status: 400 });
    }

    const api = new QBitAPI(session.host, session.apiToken);
    const data = await api.exportTorrent(hash);

    // Sanitise the requested name for use in a Content-Disposition filename.
    const baseName = (name ?? hash).replace(/[^a-zA-Z0-9 ._-]/g, "_").slice(0, 200) || hash;
    const fileName = `${baseName}.torrent`;

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "application/x-bittorrent",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(data.byteLength),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to export torrent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
