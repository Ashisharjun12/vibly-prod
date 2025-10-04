import * as Sentry from "@sentry/node"


async function initSentry() {
    try {

        Sentry.init({
            dsn: "https://4f2a3799cbc27ad4b3a3201c341d84d3@o4510117401395200.ingest.us.sentry.io/4510117403164672",
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