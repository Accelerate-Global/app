"use client";

import { AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CurrentIdentity } from "@/lib/auth";

export type AccountDrawerMode = "name" | "email" | "delete" | null;

type AccountSettingsDrawerProps = {
  identity: CurrentIdentity;
  mode: AccountDrawerMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function getDrawerContent(mode: AccountDrawerMode) {
  switch (mode) {
    case "name":
      return {
        title: "Update full name",
        description: "Choose the name shown in your account profile.",
      };
    case "email":
      return {
        title: "Update email address",
        description:
          "We’ll send a confirmation email before the address is changed.",
      };
    case "delete":
      return {
        title: "Delete account",
        description:
          "This disables future access and signs you out immediately. Your existing data stays intact.",
      };
    default:
      return {
        title: "",
        description: "",
      };
  }
}

export function AccountSettingsDrawer({
  identity,
  mode,
  open,
  onOpenChange,
}: AccountSettingsDrawerProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(identity.fullName ?? "");
  const [email, setEmail] = useState(identity.email ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const content = useMemo(() => getDrawerContent(mode), [mode]);
  const normalizedFullName = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const canSaveName =
    !isSubmitting && normalizedFullName !== (identity.fullName ?? "").trim();
  const canSaveEmail =
    !isSubmitting &&
    Boolean(normalizedEmail) &&
    normalizedEmail !== (identity.email ?? "").trim().toLowerCase();

  useEffect(() => {
    if (!open) return;

    setFullName(identity.fullName ?? "");
    setEmail(identity.email ?? "");
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
  }, [identity.email, identity.fullName, mode, open]);

  async function handleSaveName() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const nextMetadata = {
        ...((userData.user?.user_metadata as Record<string, unknown> | null) ??
          {}),
      };

      if (normalizedFullName) {
        nextMetadata.full_name = normalizedFullName;
      } else {
        delete nextMetadata.full_name;
      }

      const { error } = await supabase.auth.updateUser({
        data: nextMetadata,
      });

      if (error) {
        throw error;
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update your full name.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveEmail() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser(
        { email: normalizedEmail },
        {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
        },
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "Check your inbox to confirm the email change. If secure email change is enabled, you may also need to confirm from your current address.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start the email update flow.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisableAccount() {
    setErrorMessage(null);
    setIsSubmitting(true);

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

      onOpenChange(false);
      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not disable your account.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      direction="right"
      modal
      onOpenChange={onOpenChange}
    >
      <DrawerContent className="w-full sm:max-w-md">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle>{content.title}</DrawerTitle>
          <DrawerDescription>{content.description}</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Account update failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert>
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}

          {mode === "name" ? (
            <div className="space-y-2">
              <Label htmlFor="account-full-name">Full name</Label>
              <Input
                id="account-full-name"
                value={fullName}
                placeholder="Add full name"
                disabled={isSubmitting}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
          ) : null}

          {mode === "email" ? (
            <div className="space-y-2">
              <Label htmlFor="account-email">Email address</Label>
              <Input
                id="account-email"
                type="email"
                value={email}
                placeholder="you@example.com"
                disabled={isSubmitting}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          ) : null}

          {mode === "delete" ? (
            <Alert variant="destructive">
              <AlertTriangleIcon className="size-4" />
              <AlertTitle>Disable future access</AlertTitle>
              <AlertDescription>
                This keeps your account record and existing data, but blocks
                future sign-ins and ends your current session.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DrawerFooter className="border-t border-border sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>

          {mode === "name" ? (
            <Button type="button" disabled={!canSaveName} onClick={handleSaveName}>
              {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              Save changes
            </Button>
          ) : null}

          {mode === "email" ? (
            <Button type="button" disabled={!canSaveEmail} onClick={handleSaveEmail}>
              {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              Update email
            </Button>
          ) : null}

          {mode === "delete" ? (
            <Button
              type="button"
              variant="destructive"
              disabled={isSubmitting}
              onClick={handleDisableAccount}
            >
              {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              Delete account
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
