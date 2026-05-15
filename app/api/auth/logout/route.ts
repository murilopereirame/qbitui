import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, IronSessionData } from "@/lib/session";

export async function POST() {
  const cookieStore = await cookies();
  const session = await getIronSession<IronSessionData>(cookieStore, sessionOptions);
  session.destroy();
  return NextResponse.json({ success: true });
}
