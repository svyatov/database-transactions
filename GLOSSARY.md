# Transaction education

Teaching and evidence concepts used by this project's lessons. The evidence policy follows [#31](https://github.com/svyatov/database-transactions/issues/31) and [CONTRIBUTING.md](CONTRIBUTING.md).

**Claim**:
A behavioral statement with its applicable engine/version, operation, transaction/configuration conditions, and evidence scope.

**Scenario**:
An executable schedule with named Sessions and assertions. Shared YAML can run through both harnesses; TypeScript client-code Scenarios run through Bun only.

**Transcript**:
Generated SQL, events, results, and Scenario-authored narration from one run. It is a source mirror, not independent support for every sentence or every execution.

**Lesson**:
A published explanation that uses Scenarios, documented contracts, or marked derivations. Reference-only topics need not own a Scenario.

## Language

**Exercise**:
A learning task that asks a reader to predict the outcome of a transaction schedule and explain their reasoning before revealing the answer.

**Mechanism diagram**:
A visual explanation of the versions, visibility rules, states, or dependencies that cause a transaction result. It complements a session timeline, which shows the order of events.

**Receiver model**:
A controlled representation of a recipient whose recorded effects are outside the application transaction under study. It demonstrates that boundary without establishing the behavior of a real delivery service.

**Demonstrated behavior**:
A transaction result that a Scenario executes and asserts under stated conditions. A demonstrated execution does not by itself establish a guarantee across every possible execution.

**Documented contract**:
An engine behavior supported by its official manual under the applicable version and conditions. A documented contract is distinct from a behavior demonstrated by this project's scenarios.

**Entailed guarantee**:
A guarantee derived from stated engine or isolation semantics that the project's scenarios do not demonstrate. It is identified as an inference with its supporting explanation.
