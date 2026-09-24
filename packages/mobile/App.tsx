import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  DEFAULT_SERVER_URL,
  fetchHealth,
  type HealthResult,
} from "./src/api";
import {
  APPROVAL_STATUSES,
  CIRCUIT_STATES,
  TASK_ACTION_TYPES,
  TASK_STATUSES,
} from "./src/contracts";

const POLL_MS = 5000;

function Chip({ label }: { readonly label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export default function App() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_SERVER_URL);
  const [result, setResult] = useState<HealthResult | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const inFlight = useRef(false);

  const check = useCallback(async (url: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const next = await fetchHealth(url);
    inFlight.current = false;
    setResult(next);
    setLastCheckedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    void check(baseUrl);
    const id = setInterval(() => void check(baseUrl), POLL_MS);
    return () => clearInterval(id);
  }, [baseUrl, check]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Orbit Marketing OS</Text>
        <Text style={styles.subtitle}>Mobile monitoring surface</Text>

        <Text style={styles.label}>Backend URL</Text>
        <TextInput
          style={styles.input}
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={DEFAULT_SERVER_URL}
          testID="server-url-input"
        />
        <View style={styles.refreshRow}>
          <Button title="Check now" onPress={() => void check(baseUrl)} color="#1d4ed8" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Backend health</Text>
          {result === null ? (
            <Text style={styles.muted}>Checking…</Text>
          ) : result.ok ? (
            <View>
              <Text style={styles.okLine}>● ONLINE — {result.health.service}</Text>
              <Text style={styles.detail}>Server time: {result.health.time}</Text>
              <Text style={styles.detail}>Latency: {result.latencyMs} ms</Text>
              <Text style={styles.detail}>
                Gemini API key: {result.health.hasApiKey ? "configured" : "missing"}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={styles.errLine}>● OFFLINE</Text>
              <Text style={styles.detail}>{result.error}</Text>
            </View>
          )}
          {lastCheckedAt !== null ? (
            <Text style={styles.muted}>Last checked: {lastCheckedAt}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shared domain contracts (core)</Text>
          <Text style={styles.muted}>Task states</Text>
          <View style={styles.chips}>
            {TASK_STATUSES.map((s) => (
              <Chip key={s} label={s} />
            ))}
          </View>
          <Text style={styles.muted}>Approval states</Text>
          <View style={styles.chips}>
            {APPROVAL_STATUSES.map((s) => (
              <Chip key={s} label={s} />
            ))}
          </View>
          <Text style={styles.muted}>Circuit breaker</Text>
          <View style={styles.chips}>
            {CIRCUIT_STATES.map((s) => (
              <Chip key={s} label={s} />
            ))}
          </View>
          <Text style={styles.muted}>Queue actions</Text>
          <View style={styles.chips}>
            {TASK_ACTION_TYPES.map((s) => (
              <Chip key={s} label={s} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    padding: 20,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: "#fff",
    color: "#0f172a",
  },
  refreshRow: {
    marginVertical: 6,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginTop: 10,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  okLine: {
    color: "#15803d",
    fontWeight: "700",
    fontSize: 15,
  },
  errLine: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 15,
  },
  detail: {
    color: "#334155",
    fontSize: 13,
    marginTop: 2,
  },
  muted: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  chip: {
    backgroundColor: "#eef2ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  chipText: {
    fontSize: 12,
    color: "#3730a3",
  },
});
