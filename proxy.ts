import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, IronSessionData } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    const session = await getIronSession<IronSessionData>(req, res, sessionOptions);
    if (!session.sid || !session.host) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (req.nextUrl.pathname === "/") {
    const res2 = NextResponse.next();
    const session = await getIronSession<IronSessionData>(req, res2, sessionOptions);
    if (session.sid && session.host) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
