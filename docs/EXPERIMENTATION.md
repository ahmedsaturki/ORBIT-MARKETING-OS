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

Remaining product layers:

- automatic observations from real connector outcomes;
- campaign/content binding that compiles experiments into governed work;
- experiment-aware analytics and insight/strategy write-back;
- an explicit statistical inference methodology with documented assumptions;
- CLI/MCP/agent exposure through the same command boundary.

No external action should become possible merely by enabling experimentation.
