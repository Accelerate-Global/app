import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentOwnerId } from "@/lib/auth";

type SignInPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const ownerId = await getCurrentOwnerId();

  if (ownerId) {
    redirect("/dashboard");
  }

  const { message } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <AuthForm mode="sign-in" message={message} />
    </main>
  );
}
