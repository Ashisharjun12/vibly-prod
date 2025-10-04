
import { Worker } from "bullmq";
import { ValkeyConnection } from "../../config/valkey.js";
import { EmailWorker } from "./emailWoker.js";

export const startAllWorkers = () => {
  // Simple email worker
  const emailWorker = new Worker("email-queue", EmailWorker, { 
    connection: ValkeyConnection,
    concurrency: 2
  });

  // Simple event listeners
  emailWorker.on("completed", (job) => {
    console.log(`✅ Email sent to: ${job.data.email}`);
  });

  emailWorker.on("failed", (job, err) => {
    console.error(`❌ Email failed to ${job.data.email}:`, err.message);
  });

  console.log("📧 Email worker started");
  
  return [emailWorker];
};