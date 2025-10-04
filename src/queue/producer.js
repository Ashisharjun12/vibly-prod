import { Queue } from "bullmq";
import { ValkeyConnection } from "../config/valkey.js";


//list you queues....

const jobOptions={
  removeOnComplete: 10,
  removeOnFail: 5,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  delay: 3000, // 3 second delay between emails
}

export const EmailQueue = new Queue("email-queue", {
  connection: ValkeyConnection,
  defaultJobOptions: jobOptions
});