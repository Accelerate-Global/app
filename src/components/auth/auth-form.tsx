"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  message?: string;
};

export function AuthForm({ mode, message }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignIn = mode === "sign-in";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      if (!isSignIn) {
        const response = await fetch("/auth/sign-up", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { message?: string }
            | null;

          setError(payload?.message ?? "This email address cannot sign up.");
          return;
        }
      }

      const supabase = createSupabaseBrowserClient();
      const result =
        isSignIn
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/confirm`,
              },
            });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (mode === "sign-up" && !result.data.session) {
        router.push(
          "/?message=Check your email to confirm your account, then sign in.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Authentication failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-[rgb(38_37_49_/_0.12)] bg-card shadow-[0_24px_70px_-36px_rgba(38,37,49,0.42)]">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-[-0.03em]">
          {isSignIn ? "Sign in" : "Create account"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <Alert>
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Authentication error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="password">Password</Label>
              {isSignIn ? (
                <Link
                  className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  href="/forgot-password"
                >
                  Forgot password?
                </Link>
              ) : null}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={6}
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
            {isSignIn ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignIn ? "Need an account?" : "Already have an account?"}{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={isSignIn ? "/sign-up" : "/"}
          >
            {isSignIn ? "Sign up" : "Sign in"}
          </Link>
        </p>

        {!isSignIn ? (
          <p className="text-center text-sm text-muted-foreground">
            Sign-up is limited to emails already listed in the database
            allowlist.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
