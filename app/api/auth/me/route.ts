import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
  if (!session.sid || !session.host) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, username: session.username });
}
