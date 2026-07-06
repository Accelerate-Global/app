import { listFieldSourceGridData } from "@/lib/field-sources";
import { withRoute } from "@/lib/route-guard";

export const GET = withRoute(
  { access: "admin", action: "manage field sources" },
  async () => {
    const fieldSources = await listFieldSourceGridData();
    return Response.json(fieldSources);
  },
);
