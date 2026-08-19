import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "./lib/auth/basic-auth";

export function proxy(request: NextRequest) {
  if (isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="video-editor"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
