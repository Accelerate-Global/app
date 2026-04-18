"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ForgotPasswordFormProps = {
  message?: string;
};

export function ForgotPasswordForm({ message }: ForgotPasswordFormProps) {
  const invalidLinkTrackedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const analyticsContext = buildAnalyticsContext({
    route: "forgot_password",
    actorOwnerId: "anonymous",
    workspaceRole: "anonymous",
  });

  useEffect(() => {
    if (!message || invalidLinkTrackedRef.current) {
      return;
    }

    invalidLinkTrackedRef.current = true;
    trackAppEvent(
      "password_reset_invalid_link",
      withAnalyticsContext(analyticsContext, {
        source_surface: "forgot_password_message",
        success: false,
        error_code: "invalid_recovery_link",
      }),
    );
  }, [analyticsContext, message]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    const startedAt = Date.now();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("/reset-password", window.location.origin).toString(),
      });

      if (error) {
        trackAppEvent(
          "password_reset_requested",
          withAnalyticsContext(analyticsContext, {
            source_surface: "forgot_password_form",
            success: false,
            error_code: "password_reset_request_failed",
            duration_ms: Date.now() - startedAt,
          }),
        );
        setError(error.message);
        return;
      }

      trackAppEvent(
        "password_reset_requested",
        withAnalyticsContext(analyticsContext, {
          source_surface: "forgot_password_form",
          success: true,
          duration_ms: Date.now() - startedAt,
        }),
      );
      setSuccessMessage(
        "If an account exists for that email, a password reset link is on its way.",
      );
      form.reset();
    } catch (submitError) {
      trackAppEvent(
        "password_reset_requested",
        withAnalyticsContext(analyticsContext, {
          source_surface: "forgot_password_form",
          success: false,
          error_code: "password_reset_request_failed",
          duration_ms: Date.now() - startedAt,
        }),
      );
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not start the password reset flow.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-[rgb(38_37_49_/_0.12)] bg-card shadow-[0_24px_70px_-36px_rgba(38,37,49,0.42)]">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-[-0.03em]">
          Reset password
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <Alert variant="destructive">
            <AlertTitle>Recovery link issue</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {successMessage ? (
          <Alert>
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Password reset failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              disabled={isSubmitting}
            />
          </div>
          <Button className="w-full" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
            Send reset link
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
