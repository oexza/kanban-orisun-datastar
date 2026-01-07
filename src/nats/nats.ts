import * as nats_core from "@nats-io/nats-core";
import {connect, Subscription} from "@nats-io/transport-node";
import {createModuleLogger} from "~/utils/logger";

const logger = createModuleLogger("nats");

const NATS_URL = process.env.NATS_URL || "nats://localhost:4224";

export const createNatsConnection = async () => {
    try {
        const nc = await connect({servers: NATS_URL});
        logger.info(`✅ Connected to NATS at ${JSON.stringify(nc.getServer())}`);
        // this promise indicates the client closed
        const done = nc.closed();

        process.on("SIGTERM", async () => {
            console.log("SIGTERM received, closing NATS connection...");
            await nc.close();
            const err = await done;
            if (err) {
                console.log(`error closing:`, err);
            }
        })

        nc.closed().then(async (err?: void | Error) => {
                if (err) {
                    console.log(`NATS connection closed with error:`, err);

                    // try to reconnect
                    while (true) {
                        try {
                            console.log("Attempting to reconnect to NATS...");
                            await nc.reconnect()
                            break
                        } catch (err) {
                            //delay before retrying
                            console.log("Reconnect to NATS failed, retrying in 5 seconds...", err);
                            await new Promise(res => setTimeout(res, 5000));
                        }
                    }
                }
            }
        )

        return nc;
    } catch
        (_err) {
        console.log(`error connecting to ${JSON.stringify("v")}`);
        throw _err;
    }
}