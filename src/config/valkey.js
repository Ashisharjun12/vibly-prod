import IORedis from "ioredis";

export const ValkeyConnection = new IORedis(
  "rediss://default:ARsKAAImcDI5ZGVlNTczZjVmNzg0Y2Q1YTkyMzIxMDZhN2U1Mjc3M3AyNjkyMg@sterling-ibex-6922.upstash.io:6379",
  {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: 0,
    tls: {
      rejectUnauthorized: true,
    },
  }
);

ValkeyConnection.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

ValkeyConnection.on("connect", () => {
  console.log("✅ Redis Connected");
});

ValkeyConnection.on("ready", () => {
  console.log("✅ Redis Ready");
});