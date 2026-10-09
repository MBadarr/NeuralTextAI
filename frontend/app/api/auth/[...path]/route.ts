import { auth } from "@/features/auth/lib/auth-server";

export const { GET, POST } = auth.handler();
