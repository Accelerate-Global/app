import { listReferenceResourceCatalog } from "@/lib/reference-resources";
import { withRoute } from "@/lib/route-guard";

export const GET = withRoute({ access: "user" }, async (identity) => {
  return Response.json({
    resources: await listReferenceResourceCatalog({
      includeAdminState: identity.isDatasetAdmin,
    }),
  });
});
