import { EventStoreClient } from '@orisun/eventstore-client';
import { createModuleLogger } from "~/utils/logger";
const host = process.env.ORISUN_HOST;
const port = process.env.ORISUN_PORT ? parseInt(process.env.ORISUN_PORT, 10) : undefined;
const username = process.env.ORISUN_USERNAME;
const password = process.env.ORISUN_PASSWORD;
const logger = createModuleLogger("orisun");
/**
 * Singleton EventStore client instance
 */
let orisunClientInstance = null;
/**
 * Internal function to create the EventStore client with proper connection settings
 */
const createClientInternal = () => {
    if (orisunClientInstance) {
        console.log(`[EventStore] Reusing existing Orisun EventStore client`);
        return orisunClientInstance;
    }
    logger.info(`Creating new Orisun EventStore client with params: ` + {
        host,
        port
    });
    orisunClientInstance = new EventStoreClient({
        host,
        port,
        username,
        password,
        logger: logger,
        // Use default gRPC keep-alive settings (no custom keep-alive configuration)
        // Custom keep-alive settings were causing "excess pings" and connection drops
        loadBalancingPolicy: 'round_robin',
        enableLogging: true
    });
    return orisunClientInstance;
};
/**
 * Get the singleton EventStore client instance
 */
export const getOrisunClient = () => {
    return createClientInternal();
};
// Export the client instance for backward compatibility
const orisunClient = createClientInternal();
export { orisunClient };
