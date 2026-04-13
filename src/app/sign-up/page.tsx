import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentOwnerId } from "@/lib/auth";

export default async function SignUpPage() {
  const ownerId = await getCurrentOwnerId();

  if (ownerId) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <AuthForm mode="sign-up" />
    </main>
  );
}
