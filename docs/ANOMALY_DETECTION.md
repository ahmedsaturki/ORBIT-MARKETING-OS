# ORBIT Metric Anomaly Detection

ORBIT's anomaly layer is a deterministic, dependency-free descriptive analysis
capability over ordered metric points.

## Method

For each point after the configured lookback window, ORBIT compares the point only
with its preceding observations. The baseline is the median of the lookback values
and the dispersion is the median absolute deviation (MAD).

When MAD is non-zero, ORBIT computes the modified z-score:

`0.67448975 × (value - baselineMedian) / baselineMad`

A point is emitted when the absolute score reaches the configured threshold. When
the preceding baseline is constant (MAD = 0), any non-equal point is reported as a
constant-baseline shift.

## Safety and interpretation

The detector never looks ahead, never mutates runtime state, and never dispatches
an external connector. Its result is a descriptive anomaly signal, not a causal
conclusion, forecast, or statistical-significance claim.

The detector is a core read-only primitive. A future governed command/agent adapter must
use the canonical CommandDispatcher rather than creating a second execution system.

## Bounded configuration

- Lookback window: 3–365 points.
- Threshold: >0 and ≤100.
- Minimum absolute delta: ≥0.
- Maximum returned anomalies: 1–1000.
