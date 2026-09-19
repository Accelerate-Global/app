## REMOVED Requirements

### Requirement: Qwen is reachable only through a server-to-server gateway
**Reason**: The Qwen inference service and every application path that calls it are being removed.
**Migration**: Remove the gateway client, edge relay, origin service, credentials, and dedicated origin rather than exposing a replacement model endpoint.

### Requirement: Gateway requests are authenticated, replay-resistant, and bounded
**Reason**: No Qwen gateway request remains after decommission.
**Migration**: Delete the dedicated HMAC/Access credentials and request-verification code after admission is disabled.

### Requirement: Gateway preserves the model's containment boundary
**Reason**: The contained model runtime itself is being removed.
**Migration**: Delete the dedicated inference service, model assets, and guest after provider teardown and final confirmation.

### Requirement: The Cloudflare edge relay is least-privilege and credential-stripping
**Reason**: The Qwen Cloudflare relay is being deleted.
**Migration**: Revoke the Access token and delete the Access application/policy, Worker, VPC Service, Tunnel, and certificate in the decommission order.

### Requirement: Gateway failures are stable and observable without sensitive logs
**Reason**: The product will no longer have a gateway or gateway failure state.
**Migration**: Retired routes return the normal not-found response; the sanitized receipt retains only deletion evidence.

### Requirement: Routine tests do not depend on live Samson availability
**Reason**: Routine tests will contain no Qwen gateway path, fake gateway, or Samson Qwen dependency.
**Migration**: Delete the gateway test/fake infrastructure and retain ordinary repository test isolation.

### Requirement: Latency qualification preserves private-model containment
**Reason**: No private-model latency qualification remains relevant after model removal.
**Migration**: Delete the latency probes, qualification documents, evaluation receipts, and related service assets.

### Requirement: Verified private-origin TLS identity is reproducible from source
**Reason**: The private Qwen origin, VPC service, Tunnel, and Origin CA identity are being removed.
**Migration**: Revoke the dedicated certificate and delete source configuration after the Qwen-free deployment is verified.
