"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CurrentIdentity } from "@/lib/auth";

type AccountControlProps = {
  identity: CurrentIdentity;
};

export function AccountControl({ identity }: AccountControlProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await fetch("/auth/sign-out", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {identity.isDatasetAdmin ? <Badge>Admin</Badge> : null}
      <Badge variant="outline">{identity.email ?? "Supabase user"}</Badge>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={signOut}
        disabled={isSigningOut}
      >
        <LogOutIcon />
        Sign out
      </Button>
    </div>
  );
}
