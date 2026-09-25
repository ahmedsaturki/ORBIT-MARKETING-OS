import type { ReactElement } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchRuntimeHealth } from "../src/services/runtimeClient";
import type { RuntimeHealth } from "../src/services/runtimeClient";

const ENDPOINT_KEY = "orbit.runtime.endpoint";

export default function HomeScreen(): ReactElement {
  const [endpoint, setEndpoint] = useState("http://127.0.0.1:3000");
  const [authToken, setAuthToken] = useState("");
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [status, setStatus] = useState("لم يتم الاتصال بعد.");

  useEffect(() => {
    void AsyncStorage.getItem(ENDPOINT_KEY)
      .then(async (stored) => {
        if (stored) setEndpoint(stored);
        if (Platform.OS === "web") return;

        try {
          const secureToken =
            await SecureStore.getItemAsync("orbit.runtime.auth");
          if (secureToken) {
            setAuthToken(secureToken);
            return;
          }

          const legacyToken = await AsyncStorage.getItem("orbit.runtime.auth");
          if (legacyToken) {
            setAuthToken(legacyToken);
            await SecureStore.setItemAsync("orbit.runtime.auth", legacyToken);
            await AsyncStorage.removeItem("orbit.runtime.auth");
          }
        } catch {
          setStatus("تعذر قراءة رمز الوصول الآمن على هذا الجهاز.");
        }
      })
      .catch(() => setStatus("تعذر تحميل إعدادات runtime المحلية."));
  }, []);

  const saveAndCheck = async (): Promise<void> => {
    const clean = endpoint.trim().replace(/\/$/, "");
    if (!clean) {
      setStatus("أدخل عنوان runtime.");
      return;
    }
    await AsyncStorage.setItem(ENDPOINT_KEY, clean);
    const token = authToken.trim();

    if (Platform.OS !== "web") {
      if (token) {
        await SecureStore.setItemAsync("orbit.runtime.auth", token);
      } else {
        await SecureStore.deleteItemAsync("orbit.runtime.auth");
      }
      await AsyncStorage.removeItem("orbit.runtime.auth");
    }
    setStatus("جاري فحص runtime...");
    try {
      const result = await fetchRuntimeHealth(clean, authToken);
      setHealth(result);
      setStatus("الحالة: " + result.status);
    } catch (error: unknown) {
      setHealth(null);
      setStatus(error instanceof Error ? error.message : "تعذر الاتصال.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>ORBIT • MOBILE MONITOR</Text>
        <Text style={styles.title}>مراقبة التشغيل المحلي</Text>
        <Text style={styles.subtitle}>
          الهاتف للمراقبة والتحكم الخفيف. الأسرار والتشغيل الثقيل يبقون في
          runtime المحلي على سطح المكتب.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>عنوان runtime</Text>
          <TextInput
            value={endpoint}
            onChangeText={setEndpoint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            placeholder="http://192.168.1.10:3000"
            placeholderTextColor="#64748b"
          />
          <Text style={styles.label}>
            رمز الوصول للشبكة المحلية (اختياري على localhost)
          </Text>
          <TextInput
            value={authToken}
            onChangeText={setAuthToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.input}
            placeholder="Bearer token"
            placeholderTextColor="#64748b"
          />
          <Pressable onPress={() => void saveAndCheck()} style={styles.button}>
            <Text style={styles.buttonText}>حفظ وفحص</Text>
          </Pressable>
          <Text style={styles.status}>{status}</Text>
        </View>

        {health ? (
          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.label}>الخدمة</Text>
              <Text style={styles.value}>{health.service}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>AI</Text>
              <Text style={styles.value}>{health.provider ?? "غير متاح"}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>النموذج</Text>
              <Text style={styles.value}>{health.model ?? "غير متاح"}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>الرؤية</Text>
              <Text style={styles.value}>
                {health.visionConfigured ? "مضبوطة" : "غير مضبوطة"}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020617" },
  container: { padding: 24, gap: 16 },
  eyebrow: { color: "#34d399", fontWeight: "800", letterSpacing: 2 },
  title: { color: "#f8fafc", fontSize: 34, fontWeight: "900", marginTop: 8 },
  subtitle: { color: "#94a3b8", fontSize: 16, lineHeight: 24 },
  card: {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  grid: { gap: 12 },
  label: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  value: { color: "#e2e8f0", fontSize: 16, fontWeight: "800" },
  input: {
    backgroundColor: "#020617",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 12,
    color: "#f8fafc",
    padding: 12,
  },
  button: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
  },
  buttonText: { color: "#052e1d", fontWeight: "900" },
  status: { color: "#a7f3d0", fontSize: 12 },
});
