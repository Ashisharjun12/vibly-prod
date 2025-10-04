import { Queue } from "bullmq";
import { ValkeyConnection } from "../config/valkey.js";


//list you queues....

export const EmailQueue = new Queue("email-queue", {
  connection: ValkeyConnection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});