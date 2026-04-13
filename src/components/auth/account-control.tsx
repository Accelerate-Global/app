"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <div className="flex items-center gap-4">
      <div className="hidden min-w-0 text-right sm:block">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-foreground/55">
          {identity.isDatasetAdmin ? "Admin Access" : "Viewer Access"}
        </p>
        <p className="truncate text-sm font-semibold text-foreground">
          {identity.email ?? "Supabase user"}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="h-14 rounded-[1.2rem] border-[3px] border-primary bg-transparent px-6 text-sm font-black uppercase tracking-[0.08em] text-primary shadow-none hover:bg-accent/45"
        onClick={signOut}
        disabled={isSigningOut}
      >
        Sign out
      </Button>
    </div>
  );
}
