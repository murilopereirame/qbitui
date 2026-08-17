import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";
import { QBitAPI } from "@/lib/qbit-api";

async function getApi(): Promise<QBitAPI | null> {
  const cookieStore = await cookies();
  const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
  if (!session.apiToken || !session.host) return null;
  return new QBitAPI(session.host, session.apiToken);
}

function unauthenticated() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

function failure(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Tag names are comma-separated on the wire, so a comma cannot be part of one. */
function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && !tag.includes(","));
}

export async function GET() {
  try {
    const api = await getApi();
    if (!api) return unauthenticated();
    return NextResponse.json(await api.getTags());
  } catch (err) {
    return failure(err, "Failed to fetch tags");
  }
}

export async function POST(req: NextRequest) {
  try {
    const api = await getApi();
    if (!api) return unauthenticated();

    const { tags } = (await req.json()) as { tags?: unknown };
    const wanted = readTags(tags);
    if (wanted.length === 0) {
      return NextResponse.json({ error: "A tag name without commas is required" }, { status: 400 });
    }

    await api.createTags(wanted);
    return NextResponse.json({ success: true });
  } catch (err) {
    return failure(err, "Failed to create tags");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const api = await getApi();
    if (!api) return unauthenticated();

    const { tags } = (await req.json()) as { tags?: unknown };
    const wanted = readTags(tags);
    if (wanted.length === 0) {
      return NextResponse.json({ error: "At least one tag name is required" }, { status: 400 });
    }

    await api.deleteTags(wanted);
    return NextResponse.json({ success: true });
  } catch (err) {
    return failure(err, "Failed to delete tags");
  }
}
