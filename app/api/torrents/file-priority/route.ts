import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
    if (!session.sid || !session.host) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { hash, fileIds, priority } = await req.json() as {
      hash?: string;
      fileIds?: number[];
      priority?: number;
    };

    if (!hash || !Array.isArray(fileIds) || fileIds.length === 0 || typeof priority !== "number") {
      return NextResponse.json({ error: "hash, fileIds and priority are required" }, { status: 400 });
    }

    const api = new QBitAPI(session.host, session.sid);
    await api.setFilePriority(hash, fileIds, priority);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to change file priority";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
