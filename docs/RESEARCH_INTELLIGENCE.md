# ORBIT Research Intelligence

Research is a first-class intelligence layer in the ORBIT Marketing OS operating graph.

```
Research question
  → evidence sources
  → findings
  → confidence / freshness
  → Knowledge
  → Strategy / Campaign / Content / Learning
```

## Research Brief

A brief captures the decision question, research kind, objectives, and lifecycle. Supported kinds are competitor, market, audience, content, channel, offer, customer_voice, and general.

## Evidence

Every finding requires one or more workspace-local sources. Sources reuse the governed Knowledge Source boundary and may carry a locator such as a public URL, document reference, or interview note.

The runtime rejects:

- empty findings;
- findings without sources;
- cross-workspace source references;
- findings attached to a brief in another workspace;
- confidence outside 0..1;
- invalid observation/expiry timestamps.

## Knowledge promotion

Publishing a finding to Knowledge is explicit. ORBIT derives a bounded trust level from the declared confidence:

- 0.90–1.00 → verified
- 0.70–0.899… → approved
- below 0.70 → observed

These are operational trust labels, not statistical significance claims.

## Freshness

Findings support an optional expiry timestamp. Expiry cannot precede observation. Downstream AI grounding should treat expired findings as unavailable through the existing Knowledge context filters.

## Security

Research is workspace-scoped, auditable, and local-first. No research command executes external platform actions or exposes vault/session material.
