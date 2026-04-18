"use client";

import { AlertTriangleIcon, Loader2Icon, MailIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CurrentIdentity } from "@/lib/auth";
import {
  buildAnalyticsContext,
  getAnalyticsWorkspaceRole,
  withAnalyticsContext,
} from "@/lib/analytics";
import { trackAppEvent } from "@/lib/analytics-client";
import { buildAuthConfirmUrl } from "@/lib/auth-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AccountProfileFormProps = {
  identity: CurrentIdentity;
};

export function AccountProfileForm({ identity }: AccountProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(identity.fullName ?? "");
  const [email, setEmail] = useState(identity.email ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isDisablingAccount, setIsDisablingAccount] = useState(false);

  const normalizedFullName = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const canSaveName =
    !isSavingName && normalizedFullName !== (identity.fullName ?? "").trim();
  const canSaveEmail =
    !isSavingEmail &&
    Boolean(normalizedEmail) &&
    normalizedEmail !== (identity.email ?? "").trim().toLowerCase();
  const analyticsContext = buildAnalyticsContext({
    route: "profile",
    actorOwnerId: identity.ownerId,
    workspaceRole: getAnalyticsWorkspaceRole(identity.isDatasetAdmin),
  });

  async function handleSaveName() {
    setNameError(null);
    setNameSuccess(null);
    setIsSavingName(true);
    const startedAt = Date.now();

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const nextMetadata = {
        ...((userData.user?.user_metadata as Record<string, unknown> | null) ?? {}),
      };

      if (normalizedFullName) {
        nextMetadata.full_name = normalizedFullName;
      } else {
        delete nextMetadata.full_name;
      }

      const { error } = await supabase.auth.updateUser({ data: nextMetadata });

      if (error) {
        throw error;
      }

      trackAppEvent(
        "profile_name_updated",
        withAnalyticsContext(analyticsContext, {
          source_surface: "profile_name_form",
          success: true,
          duration_ms: Date.now() - startedAt,
        }),
      );
      setNameSuccess("Your profile name has been updated.");
      router.refresh();
    } catch (error) {
      trackAppEvent(
        "profile_name_updated",
        withAnalyticsContext(analyticsContext, {
          source_surface: "profile_name_form",
          success: false,
          error_code: "profile_name_update_failed",
          duration_ms: Date.now() - startedAt,
        }),
      );
      setNameError(
        error instanceof Error ? error.message : "Could not update your full name.",
      );
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleSaveEmail() {
    setEmailError(null);
    setEmailSuccess(null);
    setIsSavingEmail(true);
    const startedAt = Date.now();

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser(
        { email: normalizedEmail },
        {
          emailRedirectTo: buildAuthConfirmUrl(
            window.location.origin,
            "/dashboard/profile",
          ),
        },
      );

      if (error) {
        throw error;
      }

      trackAppEvent(
        "email_change_started",
        withAnalyticsContext(analyticsContext, {
          source_surface: "profile_email_form",
          success: true,
          duration_ms: Date.now() - startedAt,
        }),
      );
      setEmailSuccess(
        "Check your inbox to confirm the email change. If secure email change is enabled, you may also need to confirm from your current address.",
      );
    } catch (error) {
      trackAppEvent(
        "email_change_started",
        withAnalyticsContext(analyticsContext, {
          source_surface: "profile_email_form",
          success: false,
          error_code: "email_change_start_failed",
          duration_ms: Date.now() - startedAt,
        }),
      );
      setEmailError(
        error instanceof Error
          ? error.message
          : "Could not start the email update flow.",
      );
    } finally {
      setIsSavingEmail(false);
    }
  }

  async function handleDisableAccount() {
    setDisableError(null);
    setIsDisablingAccount(true);
    const startedAt = Date.now();

    try {
      const response = await fetch("/api/account/disable", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        throw new Error(payload?.error ?? "Could not disable your account.");
      }

      trackAppEvent(
        "account_disabled_self",
        withAnalyticsContext(analyticsContext, {
          source_surface: "profile_disable_form",
          success: true,
          duration_ms: Date.now() - startedAt,
        }),
      );
      router.push("/");
      router.refresh();
    } catch (error) {
      trackAppEvent(
        "account_disabled_self",
        withAnalyticsContext(analyticsContext, {
          source_surface: "profile_disable_form",
          success: false,
          error_code: "account_disable_failed",
          duration_ms: Date.now() - startedAt,
        }),
      );
      setDisableError(
        error instanceof Error ? error.message : "Could not disable your account.",
      );
    } finally {
      setIsDisablingAccount(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserIcon className="size-5 text-muted-foreground" />
            Profile
          </CardTitle>
          <CardDescription>
            Update the name shown across your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {nameError ? (
            <Alert variant="destructive">
              <AlertTitle>Profile update failed</AlertTitle>
              <AlertDescription>{nameError}</AlertDescription>
            </Alert>
          ) : null}
          {nameSuccess ? (
            <Alert>
              <AlertTitle>Profile updated</AlertTitle>
              <AlertDescription>{nameSuccess}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="account-full-name">Full name</Label>
            <Input
              id="account-full-name"
              value={fullName}
              placeholder={identity.email?.split("@")[0] ?? "Add full name"}
              disabled={isSavingName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <Button type="button" disabled={!canSaveName} onClick={handleSaveName}>
            {isSavingName ? <Loader2Icon className="animate-spin" /> : null}
            Save name
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MailIcon className="size-5 text-muted-foreground" />
            Email address
          </CardTitle>
          <CardDescription>
            Change the email on your account. You will need to confirm the update from your inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailError ? (
            <Alert variant="destructive">
              <AlertTitle>Email update failed</AlertTitle>
              <AlertDescription>{emailError}</AlertDescription>
            </Alert>
          ) : null}
          {emailSuccess ? (
            <Alert>
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription>{emailSuccess}</AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="account-email">Email address</Label>
            <Input
              id="account-email"
              type="email"
              value={email}
              placeholder="you@example.com"
              disabled={isSavingEmail}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="button" disabled={!canSaveEmail} onClick={handleSaveEmail}>
            {isSavingEmail ? <Loader2Icon className="animate-spin" /> : null}
            Update email
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/25">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <AlertTriangleIcon className="size-5 text-destructive" />
            Disable account
          </CardTitle>
          <CardDescription>
            This blocks future sign-ins and signs you out immediately. Existing data stays intact.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {disableError ? (
            <Alert variant="destructive">
              <AlertTitle>Account disable failed</AlertTitle>
              <AlertDescription>{disableError}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            disabled={isDisablingAccount}
            onClick={handleDisableAccount}
          >
            {isDisablingAccount ? <Loader2Icon className="animate-spin" /> : null}
            Disable account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
