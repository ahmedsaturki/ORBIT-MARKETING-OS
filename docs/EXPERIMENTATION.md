# ORBIT Experimentation & Learning

## Purpose

The Experimentation Engine is the controlled measurement layer for the ORBIT operating graph.

It turns a hypothesis into deterministic variant assignment, captures observed outcomes, summarizes the observed evidence, and emits bounded learning signals for the next strategy cycle.

The engine is deliberately separate from external execution. It does not publish, message, mutate connector state, or claim statistical significance.

## Contract

An experiment is workspace-scoped and requires:

- a hypothesis;
- an objective metric;
- at least two unique variants;
- positive allocation percentages totaling 100%;
- an optional UTC-compatible start/end window.

A subject is assigned using a deterministic FNV-1a bucket derived from:

`workspaceId:experimentId:subjectId`

The same subject therefore receives the same variant for the same experiment/workspace across supported runtimes.

Variant delivery is explicit. A campaign-bound experiment must map each variant to a unique content item already attached to the campaign, or to a unique message source. The compiler rejects cross-workspace bindings, unattached content, and duplicate delivery sources.

Once an experiment leaves `draft`, its variant definition is immutable. Recorded observations must also use the deterministic assignment for their workspace/experiment/subject; otherwise the observation is rejected rather than contaminating the evidence set.

## Observation model

Observations are scoped by both experiment ID and workspace ID.

For each variant ORBIT computes:

- exposures;
- engagements;
- conversions;
- total observed value;
- engagement rate;
- conversion rate.

Observations from another workspace are ignored by the summary function.

## Learning signals

The current core layer emits factual signals such as conversion/value leaders.

It explicitly emits:

`statistical_significance_not_claimed`

This is intentional: a raw rate comparison is not presented as a statistically significant result without a future inference layer and appropriate sample-size assumptions.

## Product boundary

Current implemented layers:

- pure @orbit/core domain primitives;
- deterministic, workspace-bound assignment;
- strict variant/time-window validation;
- workspace-scoped observation aggregation;
- regression tests for unknown variants and unexposed value;
- native SQLite persistence through schema v14;
- native deterministic assignment and summary commands;
- workspace integrity triggers;
- audit and operational-event integration;
- governed Command Registry entries;
- desktop Experiment Studio control surface.

Implemented next layer:

- campaign/content binding that compiles experiment variants into deterministic, dependency-ordered governed work;
- experiment learning write-back artifacts for observed conversion/value signals and insufficient-evidence states;
- learning artifacts are workspace-scoped and explicitly descriptive; the current core does not claim causality or statistical significance.

Still remaining:

- automatic observations from real connector outcomes;
- persisted native write-back through the outcome/strategy command surfaces;
- an explicit statistical inference methodology with documented assumptions;
- agent exposure through the same command boundary; CLI/MCP now expose governed registry and authorization previews. Executable actions remain bound to the canonical CommandDispatcher.

No external action should become possible merely by enabling experimentation.


## Descriptive uncertainty inference

The core experimentation package now exposes bounded Wilson proportion intervals for engagement and conversion rates plus pairwise rate-difference intervals. These are descriptive uncertainty intervals for the observed evidence set. ORBIT does not turn an interval into an automatic significance, causal, or platform-enforcement claim; those claims require a separately reviewed inference methodology and appropriate experimental design.

Supported confidence levels are 80%, 90%, 95%, 98%, and 99%. Zero-exposure variants return an empty evidence interval [0, 0] rather than inventing certainty.
