import IORedis from "ioredis";
import { _config } from "./config.js";


export const ValkeyConnection = new IORedis(
  _config.REDIS_URI,
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