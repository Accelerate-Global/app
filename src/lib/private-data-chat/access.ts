import type { CurrentIdentity } from "@/lib/auth";
import {
  getPrivateDataChatConfiguration,
  type PrivateDataChatConfiguration,
} from "@/lib/private-data-chat/config";

export function isPrivateDataChatPilotIdentity(
  identity: CurrentIdentity | null | undefined,
  configuration: PrivateDataChatConfiguration =
    getPrivateDataChatConfiguration(),
) {
  const normalizedEmail = identity?.email?.trim().toLowerCase();

  return Boolean(
    identity?.isDatasetAdmin &&
      normalizedEmail &&
      configuration.canaryEmails.includes(normalizedEmail),
  );
}

export function canUsePrivateDataChat(
  identity: CurrentIdentity | null | undefined,
  configuration: PrivateDataChatConfiguration =
    getPrivateDataChatConfiguration(),
) {
  return isPrivateDataChatPilotIdentity(identity, configuration) && configuration.ready;
}
