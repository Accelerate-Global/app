import { redirect } from "next/navigation";

import { PrivateDataChatClient } from "@/components/chat/private-data-chat-client";
import { DashboardPageShell } from "@/components/layout/dashboard-page-shell";
import { getCurrentIdentity } from "@/lib/auth";
import { getPrivateDataChatConfiguration } from "@/lib/private-data-chat/config";
import { isPrivateDataChatPilotIdentity } from "@/lib/private-data-chat/access";

export default async function PrivateDataChatPage() {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect("/");
  }

  const configuration = getPrivateDataChatConfiguration();

  if (!isPrivateDataChatPilotIdentity(identity, configuration)) {
    redirect("/dashboard");
  }

  return (
    <div
      data-smoke-page="private-data-chat"
      data-smoke-page-ready="private-data-chat"
    >
      <DashboardPageShell>
        <section className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Administrator pilot
          </p>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
            Private data chat
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Explore the approved current people-groups dataset through the locally
            hosted Qwen 3.6 model and a deterministic read-only query boundary.
          </p>
        </section>
        <PrivateDataChatClient available={configuration.ready} />
      </DashboardPageShell>
    </div>
  );
}
