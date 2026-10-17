import { SignJWT, jwtVerify } from "jose";

export const CUSTOMER_COOKIE = "bankak_customer";
export const STAFF_COOKIE = "bankak_staff";

export type TokenPayload = {
  sub: string;
  kind: "customer" | "staff";
  role: string;
  name: string;
  purpose?: "session" | "mfa";
};

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: TokenPayload, expiresIn: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function readToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey());
  return payload as unknown as TokenPayload & { exp?: number };
}
