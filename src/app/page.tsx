import { redirect } from "next/navigation";

import { getCurrentOwnerId } from "@/lib/auth";

export default async function Home() {
  const ownerId = await getCurrentOwnerId();
  redirect(ownerId ? "/dashboard" : "/sign-in");
}
