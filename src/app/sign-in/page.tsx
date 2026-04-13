import { redirect } from "next/navigation";

import { getCurrentOwnerId } from "@/lib/auth";

export default async function SignInPage() {
  const ownerId = await getCurrentOwnerId();

  if (ownerId) {
    redirect("/dashboard");
  }

  redirect("/");
}
