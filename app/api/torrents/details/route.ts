import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";
import { PartialTorrentDetails, TorrentDetailsSection } from "@/lib/types";

const ALL_SECTIONS: TorrentDetailsSection[] = ["properties", "trackers", "peers", "webSeeds", "files"];

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
    if (!session.sid || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const hash = new URL(req.url).searchParams.get("hash");
    const requestedSections = new URL(req.url).searchParams.getAll("section") as TorrentDetailsSection[];
    if (!hash) {
      return NextResponse.json({ error: "Hash is required" }, { status: 400 });
    }

    const sections = requestedSections.length > 0
      ? ALL_SECTIONS.filter((section) => requestedSections.includes(section))
      : ALL_SECTIONS;
    if (sections.length === 0) {
      return NextResponse.json({ error: "At least one valid section is required" }, { status: 400 });
    }

    const api = new QBitAPI(session.host, session.sid);
    const details: PartialTorrentDetails = {};

    await Promise.all(
      sections.map(async (section) => {
        switch (section) {
          case "properties":
            details.properties = await api.getTorrentProperties(hash);
            break;
          case "trackers":
            details.trackers = await api.getTorrentTrackers(hash);
            break;
          case "peers":
            details.peers = await api.getTorrentPeers(hash);
            break;
          case "webSeeds":
            details.webSeeds = await api.getTorrentWebSeeds(hash);
            break;
          case "files":
            details.files = await api.getTorrentFiles(hash);
            break;
        }
      })
    );

    return NextResponse.json(details);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
