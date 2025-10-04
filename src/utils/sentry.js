import * as Sentry from "@sentry/node"
import { _config } from "../config/config.js";


async function initSentry() {
    try {

        Sentry.init({
            dsn: _config.SENTRY_DSN,
            // Setting this option to true will send default PII data to Sentry.
            // For example, automatic IP address collection on events
            sendDefaultPii: true,
          });
    } catch (error) {
        console.error("Error in initializing Sentry:", error);
        throw error;
    }
}

export default initSentry;