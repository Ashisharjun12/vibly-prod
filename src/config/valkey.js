import IORedis from "ioredis";

export const ValkeyConnection = new IORedis({maxRetriesPerRequest:null});