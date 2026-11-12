import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Data Access Layer: centralizes the "is there a signed-in user" check.
// src/proxy.ts only does an optimistic cookie check — this is the real guard,
// called from every page/action/route handler that needs the current user.
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}
