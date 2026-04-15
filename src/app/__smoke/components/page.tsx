import { notFound } from "next/navigation";

import { UiSmokeGallery } from "./ui-smoke-gallery";

export default function UiSmokeComponentsPage() {
  if (process.env.UI_SMOKE_ENABLED !== "1") {
    notFound();
  }

  return (
    <main
      data-smoke-page="smoke-components"
      className="min-h-svh bg-background"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-[3.1rem]">
            UI Smoke Fixtures
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Shared UI primitives rendered in stable states for Playwright smoke
            verification.
          </p>
        </section>
        <UiSmokeGallery />
      </div>
    </main>
  );
}
