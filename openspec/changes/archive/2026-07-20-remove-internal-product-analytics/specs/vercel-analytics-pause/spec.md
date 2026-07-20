## REMOVED Requirements

### Requirement: Client analytics events persist internally
**Reason**: The application no longer collects custom product analytics in any
authenticated or anonymous browser context.

**Migration**: Remove browser instrumentation and the internal ingestion endpoint;
retain Supabase Auth Last sign-in for account recency.

### Requirement: Server analytics events persist internally
**Reason**: No production server workflow depends on the unused analytics server
facade or internal event warehouse.

**Migration**: Preserve normalized runtime error logging and domain-owned history;
remove only product-event persistence.

### Requirement: Vercel Web Analytics script is not mounted
**Reason**: The prohibition moves to the broader `product-analytics-boundary`
capability as the old pause capability is retired.

**Migration**: Continue omitting the collector and CSP origins under the new
durable requirement.
