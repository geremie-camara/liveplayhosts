import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define protected routes - these require authentication
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/training(.*)",
  "/schedule(.*)",
  "/profile(.*)",
  "/admin(.*)",
]);

// Define admin-only routes
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Define routes that require at least "host" role
const isHostRoute = createRouteMatcher(["/schedule(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Protect authenticated routes
  if (isProtectedRoute(req)) {
    const { userId, sessionClaims } = await auth.protect();

    // Get user role from session claims (public metadata)
    const role = (sessionClaims?.metadata as { role?: string })?.role;

    // Check admin routes
    if (isAdminRoute(req) && role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Check host routes (host, senior_host, admin can access)
    if (isHostRoute(req)) {
      const allowedRoles = ["host", "senior_host", "admin"];
      if (!role || !allowedRoles.includes(role)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
