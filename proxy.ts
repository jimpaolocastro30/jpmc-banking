import { NextResponse, type NextRequest } from "next/server";
import { CUSTOMER_COOKIE, STAFF_COOKIE, readToken } from "@/lib/jwt";

const customerRoots = ["/home", "/accounts", "/transfers", "/payments", "/cards", "/notifications", "/profile", "/more", "/transactions", "/requests", "/activity"];

async function valid(token: string | undefined, kind: "customer" | "staff") {
  if (!token) return false;
  try {
    const payload = await readToken(token);
    return payload.kind === kind && payload.purpose !== "mfa";
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api")) return NextResponse.next();

  const customerOk = await valid(request.cookies.get(CUSTOMER_COOKIE)?.value, "customer");
  const staffOk = await valid(request.cookies.get(STAFF_COOKIE)?.value, "staff");

  if (pathname === "/login" && customerOk) {
    return NextResponse.redirect(new URL("/home", request.url));
  }
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return staffOk ? NextResponse.redirect(new URL("/admin/dashboard", request.url)) : NextResponse.next();
    }
    if (!staffOk) return NextResponse.redirect(new URL("/admin/login", request.url));
    return NextResponse.next();
  }
  if (customerRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`)) && !customerOk) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
