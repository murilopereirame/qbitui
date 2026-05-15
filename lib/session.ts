import { SessionOptions } from "iron-session";

export interface IronSessionData {
  host: string;
  sid: string;
  username: string;
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
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};
