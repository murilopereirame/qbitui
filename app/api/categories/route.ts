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

export async function GET() {
  try {
    const api = await getApi();
    if (!api) return unauthenticated();
    return NextResponse.json(await api.getCategories());
  } catch (err) {
    return failure(err, "Failed to fetch categories");
  }
}

export async function POST(req: NextRequest) {
  try {
    const api = await getApi();
    if (!api) return unauthenticated();

    const { name, savePath } = (await req.json()) as { name?: string; savePath?: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    await api.createCategory(name.trim(), savePath?.trim() ?? "");
    return NextResponse.json({ success: true });
  } catch (err) {
    return failure(err, "Failed to create category");
  }
}

/** Changes an existing category's save path; qBittorrent cannot rename one. */
export async function PATCH(req: NextRequest) {
  try {
    const api = await getApi();
    if (!api) return unauthenticated();

    const { name, savePath } = (await req.json()) as { name?: string; savePath?: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    await api.editCategory(name.trim(), savePath?.trim() ?? "");
    return NextResponse.json({ success: true });
  } catch (err) {
    return failure(err, "Failed to edit category");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const api = await getApi();
    if (!api) return unauthenticated();

    const { names } = (await req.json()) as { names?: unknown };
    const wanted = Array.isArray(names)
      ? names.filter((name): name is string => typeof name === "string" && name.length > 0)
      : [];
    if (wanted.length === 0) {
      return NextResponse.json({ error: "At least one category name is required" }, { status: 400 });
    }

    await api.removeCategories(wanted);
    return NextResponse.json({ success: true });
  } catch (err) {
    return failure(err, "Failed to remove categories");
  }
}
