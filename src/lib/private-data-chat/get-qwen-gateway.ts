import { getPrivateDataChatConfiguration } from "@/lib/private-data-chat/config";
import { FakePrivateQwenGateway } from "@/lib/private-data-chat/fake-qwen-gateway";
import {
  HttpPrivateQwenGateway,
  type PrivateQwenGateway,
} from "@/lib/private-data-chat/qwen-gateway";

let gateway: PrivateQwenGateway | null = null;

export function getPrivateQwenGateway() {
  if (gateway) {
    return gateway;
  }

  gateway = getPrivateDataChatConfiguration().useFakeQwen
    ? new FakePrivateQwenGateway()
    : new HttpPrivateQwenGateway();
  return gateway;
}

export function setPrivateQwenGatewayForTests(value: PrivateQwenGateway | null) {
  gateway = value;
}
