## MODIFIED Requirements

### Requirement: Natural geographic population questions remain in reviewed scope
Private data chat SHALL interpret an unqualified “how many people” question about an exact approved country or reviewed filter region as the `total_population` metric over that geography. It MUST continue to interpret “how many people groups” as `people_group_count`, MUST execute these exact scalar intents through an application-owned typed plan and deterministic grounded response, MUST NOT answer from general geographic knowledge, and MUST preserve bounded refusal or clarification for unrecognized or ambiguous scope. Exact approved short country codes MAY resolve deterministic scalar requests, but contained aliases MUST NOT create geographic authority or ambiguity unless they cover the complete geography candidate apart from connectors.

#### Scenario: User asks how many people are in India
- **WHEN** the user asks “How many people are in India?”
- **THEN** chat executes the approved total-population metric with the deterministically resolved India country filter and returns the grounded result

#### Scenario: User asks how many people are in South Asia
- **WHEN** `South Asia` exactly resolves to the reviewed `Asia, South` filter region
- **THEN** chat executes the approved total-population metric over the exact authoritative region country set and identifies the result as South Asia

#### Scenario: User asks how many people groups are in India
- **WHEN** the user explicitly asks for people groups rather than people
- **THEN** chat uses `people_group_count` rather than `total_population`

#### Scenario: Geography alias appears as ordinary analytical prose
- **WHEN** a richer supported analytical question contains words or field labels such as `to`, `and`, or `Global Engagement Anywhere` that overlap approved geography aliases
- **THEN** those partial overlaps do not create a second geography, and the complete request continues through the reviewed planner path

#### Scenario: Geography is not reviewed
- **WHEN** the question names no exact approved country or reviewed filter region and otherwise lacks approved data scope
- **THEN** chat refuses or clarifies without using model world knowledge or executing a broader query
