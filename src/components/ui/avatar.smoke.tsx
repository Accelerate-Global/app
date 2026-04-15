"use client";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { defineUiSmokeFixture } from "@/lib/ui-smoke";

function AvatarSmokeFixture() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>AG</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>UI</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+2</AvatarGroupCount>
    </AvatarGroup>
  );
}

export default defineUiSmokeFixture({
  id: "avatar",
  title: "Avatar",
  description: "User identity and grouped presence indicators.",
  Component: AvatarSmokeFixture,
});
