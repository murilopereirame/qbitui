import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";
import { TorrentAction } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { action, hashes, deleteFiles, category, tags } = await req.json() as {
      action: TorrentAction;
      hashes: string[];
      deleteFiles?: boolean;
      /** Target category for "setCategory"; empty string clears it. */
      category?: string;
      /** Tag names for "addTags" / "removeTags". */
      tags?: string[];
    };

    if (!action || !hashes || !Array.isArray(hashes) || hashes.length === 0) {
      return NextResponse.json({ error: "Action and hashes are required" }, { status: 400 });
    }

    const api = new QBitAPI(session.host, session.apiToken);
    const wantedTags = Array.isArray(tags)
      ? tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim())
      : [];

    switch (action) {
      case "pause":
        await api.pauseTorrents(hashes);
        break;
      case "resume":
        await api.resumeTorrents(hashes);
        break;
      case "delete":
        await api.deleteTorrents(hashes, deleteFiles ?? false);
        break;
      case "recheck":
        await api.recheckTorrents(hashes);
        break;
      case "reannounce":
        await api.reannounceTorrents(hashes);
        break;
      case "topPrio":
        await api.moveTorrentsTop(hashes);
        break;
      case "increasePrio":
        await api.moveTorrentsUp(hashes);
        break;
      case "decreasePrio":
        await api.moveTorrentsDown(hashes);
        break;
      case "bottomPrio":
        await api.moveTorrentsBottom(hashes);
        break;
      case "setCategory":
        // An absent category is a deliberate "no category" here.
        await api.setTorrentCategory(hashes, typeof category === "string" ? category : "");
        break;
      case "addTags":
        if (wantedTags.length === 0) {
          return NextResponse.json({ error: "At least one tag is required" }, { status: 400 });
        }
        await api.addTorrentTags(hashes, wantedTags);
        break;
      case "removeTags":
        if (wantedTags.length === 0) {
          return NextResponse.json({ error: "At least one tag is required" }, { status: 400 });
        }
        await api.removeTorrentTags(hashes, wantedTags);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
