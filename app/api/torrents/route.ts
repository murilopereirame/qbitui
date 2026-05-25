import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<IronSessionData>(cookieStore, sessionOptions);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") ?? undefined;
    const category = url.searchParams.get("category") ?? undefined;
    const tag = url.searchParams.get("tag") ?? undefined;

    const api = new QBitAPI(session.host, session.apiToken);
    const torrents = await api.getTorrents(filter, category, tag);
    return NextResponse.json(torrents);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch torrents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.apiToken || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const api = new QBitAPI(session.host, session.apiToken);
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("torrents") as File | null;
      const savepath = formData.get("savepath") as string | undefined;
      const category = formData.get("category") as string | undefined;
      const tags = formData.get("tags") as string | undefined;
      const paused = formData.get("paused") === "true";

      if (!file) {
        return NextResponse.json({ error: "No torrent file provided" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await api.addTorrentFile(buffer, file.name, { savepath, category, tags, paused });
    } else {
      const body = await req.json();
      const { urls, savepath, category, tags, paused } = body;

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return NextResponse.json({ error: "No magnet URLs provided" }, { status: 400 });
      }

      await api.addMagnet(urls, { savepath, category, tags, paused });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add torrent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
