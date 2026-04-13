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
  CardDescription,
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createSupabaseBrowserClient();
      const result =
        mode === "sign-in"
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
          "/sign-in?message=Check your email to confirm your account, then sign in.",
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

  async function bypassLogin() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/auth/bypass", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Testing mode could not be started.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (bypassError) {
      setError(
        bypassError instanceof Error
          ? bypassError.message
          : "Testing mode could not be started.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSignIn = mode === "sign-in";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isSignIn ? "Sign in" : "Create account"}</CardTitle>
        <CardDescription>
          {isSignIn
            ? "Use your Supabase account to open your CSV workspace."
            : "Create a Supabase account for your CSV workspace."}
        </CardDescription>
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
            <Label htmlFor="password">Password</Label>
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

        <Button
          className="w-full"
          type="button"
          variant="outline"
          onClick={bypassLogin}
          disabled={isSubmitting}
        >
          Bypass login for testing
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isSignIn ? "Need an account?" : "Already have an account?"}{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={isSignIn ? "/sign-up" : "/sign-in"}
          >
            {isSignIn ? "Sign up" : "Sign in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
