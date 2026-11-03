import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { installGracefulShutdown } from "./lib/shutdown";

// pg removes failed idle clients itself. Handle the background event so a DB
// restart neither crashes the API nor dumps a connection object into logs.
pool.on("error", () => {
  logger.warn("Idle database connection closed; the pool will replace it");
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

installGracefulShutdown(server, { closeResources: () => pool.end(), logger });
