"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type ResetPasswordFormProps = {
  initialCanReset: boolean;
};

function hasAuthCallbackHash() {
  if (typeof window === "undefined") {
    return false;
  }

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  return Boolean(
    hashParams.get("access_token") ||
      hashParams.get("refresh_token") ||
      hashParams.get("type"),
  );
}

function getAuthCallbackCodeFromQuery() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URL(window.location.href).searchParams.get("code");
}

function hasAuthCallbackParams() {
  return hasAuthCallbackHash() || Boolean(getAuthCallbackCodeFromQuery());
}

function getAuthCallbackSessionFromHash() {
  if (typeof window === "undefined") {
    return null;
  }

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

export function ResetPasswordForm({
  initialCanReset,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const invalidLinkTrackedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [canReset, setCanReset] = useState(initialCanReset);
  const [isResolvingRecovery, setIsResolvingRecovery] = useState(
    () => !initialCanReset && hasAuthCallbackParams(),
  );
  const analyticsContext = buildAnalyticsContext({
    route: "reset_password",
    actorOwnerId: "anonymous",
    workspaceRole: "anonymous",
  });

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  useEffect(() => {
    if (initialCanReset || !hasAuthCallbackParams()) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const recoveryResolutionTimeout = window.setTimeout(() => {
      setIsResolvingRecovery(false);
    }, 3_000);

    void (async () => {
      const recoveryCode = getAuthCallbackCodeFromQuery();

      if (recoveryCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(recoveryCode);

        if (!error) {
          setCanReset(true);
          setIsResolvingRecovery(false);
          window.clearTimeout(recoveryResolutionTimeout);
          return;
        }
      }

      const recoverySession = getAuthCallbackSessionFromHash();

      if (recoverySession) {
        const { error } = await supabase.auth.setSession(recoverySession);

        if (!error) {
          setCanReset(true);
          setIsResolvingRecovery(false);
          window.clearTimeout(recoveryResolutionTimeout);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setCanReset(true);
        setIsResolvingRecovery(false);
        window.clearTimeout(recoveryResolutionTimeout);
      }
    })()
      .catch(() => {
        setIsResolvingRecovery(false);
        window.clearTimeout(recoveryResolutionTimeout);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === "INITIAL_SESSION" ||
          event === "PASSWORD_RECOVERY" ||
          event === "SIGNED_IN")
      ) {
        setCanReset(true);
        setIsResolvingRecovery(false);
        window.clearTimeout(recoveryResolutionTimeout);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(recoveryResolutionTimeout);
    };
  }, [initialCanReset]);

  useEffect(() => {
    if (canReset || isResolvingRecovery || invalidLinkTrackedRef.current) {
      return;
    }

    invalidLinkTrackedRef.current = true;
    trackAppEvent(
      "password_reset_invalid_link",
      withAnalyticsContext(analyticsContext, {
        source_surface: "reset_password_form",
        success: false,
        error_code: "invalid_recovery_link",
      }),
    );
  }, [analyticsContext, canReset, isResolvingRecovery]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordsMatch) {
      setError("Passwords must match.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const startedAt = Date.now();

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      trackAppEvent(
        "password_reset_completed",
        withAnalyticsContext(analyticsContext, {
          source_surface: "reset_password_form",
          success: true,
          duration_ms: Date.now() - startedAt,
        }),
      );
      router.push("/?message=Password updated. Sign in with your new password.");
      router.refresh();
    } catch (submitError) {
      trackAppEvent(
        "password_reset_completed",
        withAnalyticsContext(analyticsContext, {
          source_surface: "reset_password_form",
          success: false,
          error_code: "password_reset_update_failed",
          duration_ms: Date.now() - startedAt,
        }),
      );
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not update your password.",
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
        {!canReset && !isResolvingRecovery ? (
          <Alert variant="destructive">
            <AlertTitle>Recovery link issue</AlertTitle>
            <AlertDescription>
              This password setup link is invalid or has expired. Request a new
              one to continue.
            </AlertDescription>
          </Alert>
        ) : null}

        {!canReset && isResolvingRecovery ? (
          <Alert>
            <AlertTitle>Validating password setup link</AlertTitle>
            <AlertDescription>
              One moment while the password setup session is restored.
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Password reset failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {canReset ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={6}
                required
                value={password}
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                minLength={6}
                required
                value={confirmPassword}
                disabled={isSubmitting}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              Save new password
            </Button>
          </form>
        ) : null}

        <p className="text-center text-sm text-muted-foreground">
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={canReset ? "/" : "/forgot-password"}
          >
            {canReset ? "Back to sign in" : "Request a new reset link"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
