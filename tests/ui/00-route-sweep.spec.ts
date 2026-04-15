import { test } from "@playwright/test";

import { smokeRouteSpecs } from "./route-registry";
import { getSmokeProjectContext } from "./support/project-context";
import { assertSmokeRoute } from "./support/smoke-helpers";

for (const route of smokeRouteSpecs) {
  test(route.id, async ({ page }, testInfo) => {
    const project = getSmokeProjectContext(testInfo.project.name);

    test.skip(
      project.role !== route.role,
      `Skipping ${route.id} for ${testInfo.project.name}`,
    );

    await assertSmokeRoute(page, route);
  });
}
