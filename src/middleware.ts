import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except for
    // - /api routes
    // - /_next (Next.js internals)
    // - /_vercel (Vercel internals)
    // - /static (static files)
    // - all files with extensions (e.g. .ico, .svg)
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
