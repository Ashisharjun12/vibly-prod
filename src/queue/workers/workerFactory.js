
import { Worker } from "bullmq";
import { ValkeyConnection } from "../../config/valkey.js";
import { EmailWorker } from "./emailWoker.js";

export const startAllWorkers = () => {
  // Email worker with rate limiting
  const emailWorker = new Worker("email-queue", EmailWorker, { 
    connection: ValkeyConnection,
    concurrency: 1, // Process only 1 email at a time
    limiter: {
      max: 10, // Maximum 10 emails
      duration: 60000, // Per 60 seconds (1 minute)
    },
    settings: {
      stalledInterval: 30000, 
      maxStalledCount: 1, 
    }
  });

  //  event listeners
  emailWorker.on("completed", (job) => {
    console.log(`✅ Email sent to: ${job.data.email}`);
  });

  emailWorker.on("failed", (job, err) => {
    console.error(`❌ Email failed to ${job.data.email}:`, err.message);
  });

  console.log("📧 Email worker started");
  
  return [emailWorker];
};