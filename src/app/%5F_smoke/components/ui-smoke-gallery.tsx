"use client";

import { uiSmokeFixtures } from "@/components/ui/smoke-fixtures.generated";

export function UiSmokeGallery() {
  return (
    <div className="grid gap-5">
      {uiSmokeFixtures.map((fixture) => (
        <section
          key={fixture.id}
          data-ui-smoke-fixture={fixture.id}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              {fixture.title}
            </h2>
            {fixture.description ? (
              <p className="text-sm text-muted-foreground">
                {fixture.description}
              </p>
            ) : null}
          </div>
          <div className="mt-4">
            <fixture.Component />
          </div>
        </section>
      ))}
    </div>
  );
}
