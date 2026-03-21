import { NextResponse, type NextRequest } from "next/server";
import { convexAuthNextjsMiddleware } from "@convex-dev/auth/nextjs/server";

const authMiddleware = convexAuthNextjsMiddleware();

export default async function middleware(request: NextRequest, event: unknown) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const response = (await authMiddleware(request, event as never)) ?? NextResponse.next();
  response.headers.set("x-request-id", requestId);

  console.info(
    JSON.stringify({
      event: "http.request",
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: response.status,
      at: new Date().toISOString(),
    }),
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
