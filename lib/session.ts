import { SessionOptions } from "iron-session";

export interface IronSessionData {
  host: string;
  apiToken: string;
}

function getSessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error(
      "SESSION_SECRET environment variable must be set and at least 32 characters long in production"
    );
  }
  return secret ?? "dev-only-password-not-for-production-use!!";
}

export const sessionOptions: SessionOptions = {
  get password() {
    return getSessionPassword();
  },
  cookieName: "qbitui_session",
  cookieOptions: {
    // In the Electron app the embedded Next.js server is reached over plain HTTP
    // on localhost, so we must not set the Secure flag.
    secure: process.env.NODE_ENV === "production" && process.env.ELECTRON_APP !== "true",
    httpOnly: true,
    sameSite: "lax",
  },
};
