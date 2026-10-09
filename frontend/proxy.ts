import { auth } from "@/lib/auth-server";

// Neon exchanges the OAuth verifier and renews cookies here, before RSC rendering.
export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  matcher: ["/", "/auth/sign-in", "/auth/sign-up", "/auth/callback"],
};
