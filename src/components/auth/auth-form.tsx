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
import {
  buildAnalyticsContext,
  withAnalyticsContext,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";
import { buildAuthConfirmUrl } from "@/lib/auth-redirect";
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
  const analyticsContext = buildAnalyticsContext({
    route: isSignIn ? "sign_in" : "sign_up",
    actorOwnerId: "anonymous",
    workspaceRole: "anonymous",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const startedAt = Date.now();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      if (!isSignIn) {
        trackAppEvent(
          "auth_sign_up_started",
          withAnalyticsContext(analyticsContext, {
            source_surface: "auth_form",
            success: true,
          }),
        );

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

          trackAppEvent(
            "auth_sign_up_allowlist_rejected",
            withAnalyticsContext(analyticsContext, {
              source_surface: "auth_form",
              success: false,
              error_code: "allowlist_rejected",
              duration_ms: Date.now() - startedAt,
            }),
          );
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
                emailRedirectTo: buildAuthConfirmUrl(
                  window.location.origin,
                ),
              },
            });

      if (result.error) {
        if (isSignIn) {
          trackAppEvent(
            "auth_sign_in_failed",
            withAnalyticsContext(analyticsContext, {
              source_surface: "auth_form",
              success: false,
              error_code: "invalid_credentials",
              duration_ms: Date.now() - startedAt,
            }),
          );
        }

        setError(result.error.message);
        return;
      }

      if (mode === "sign-up" && !result.data.session) {
        trackAppEvent(
          "auth_sign_up_confirmation_required",
          withAnalyticsContext(analyticsContext, {
            source_surface: "auth_form",
            success: true,
            duration_ms: Date.now() - startedAt,
          }),
        );
        router.push(
          "/?message=Check your email to confirm your account, then sign in.",
        );
        return;
      }

      trackAppEvent(
        isSignIn ? "auth_sign_in_succeeded" : "auth_sign_up_succeeded",
        withAnalyticsContext(analyticsContext, {
          source_surface: "auth_form",
          success: true,
          duration_ms: Date.now() - startedAt,
        }),
      );
      router.push("/dashboard");
      router.refresh();
    } catch (submitError) {
      if (isSignIn) {
        trackAppEvent(
          "auth_sign_in_failed",
          withAnalyticsContext(analyticsContext, {
            source_surface: "auth_form",
            success: false,
            error_code: "auth_request_failed",
            duration_ms: Date.now() - startedAt,
          }),
        );
      }

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
