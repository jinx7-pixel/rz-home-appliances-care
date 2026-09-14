import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const TRUSTED_PROXY_PEERS = ["127.0.0.1/32", "::1/128"] as const;
const EXPECTED_PROXY_ADDRESSES = ["127.0.0.1", "::1"] as const;
const PRODUCTION_PROXY_PEERS_ENV = "PRODUCTION_PROXY_PEERS";

// The deployed application router is the only public ingress and forwards to
// this service over the local loopback interface. Trust only those exact
// addresses so a request from any other peer cannot choose its identity with
// X-Forwarded-For. Do not replace this with `true` or a hop count: both would
// allow a directly connected client to spoof the forwarded address.
app.set("trust proxy", [...TRUSTED_PROXY_PEERS]);

function normalizedRemoteAddress(address: string | undefined): string | undefined {
  if (!address) {
    return undefined;
  }

  // Node may expose an IPv4 loopback peer as an IPv4-mapped IPv6 address when
  // the server is listening on an IPv6 socket.
  return address.replace(/^::ffff:/i, "");
}

function reportProductionProxyConfiguration(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const configuredPeers =
    process.env[PRODUCTION_PROXY_PEERS_ENV]
      ?.split(",")
      .map((peer) => peer.trim())
      .filter(Boolean) ?? [];
  const configurationMatches =
    configuredPeers.length === TRUSTED_PROXY_PEERS.length &&
    TRUSTED_PROXY_PEERS.every((peer, index) => configuredPeers[index] === peer);

  if (!configurationMatches) {
    logger.error(
      {
        configuredPeers,
        expectedPeers: TRUSTED_PROXY_PEERS,
      },
      "Unexpected production proxy peer configuration; security review required before changing the trusted proxy list",
    );
    return;
  }

  logger.info(
    { expectedPeers: TRUSTED_PROXY_PEERS },
    "Production proxy peer configuration verified",
  );
}

reportProductionProxyConfiguration();

app.use((req, _res, next) => {
  const remoteAddress = normalizedRemoteAddress(req.socket.remoteAddress);

  if (!EXPECTED_PROXY_ADDRESSES.some((address) => address === remoteAddress)) {
    logger.error(
      {
        method: req.method,
        path: req.path,
        remoteAddress: remoteAddress ?? "unknown",
        expectedPeers: EXPECTED_PROXY_ADDRESSES,
      },
      "Request arrived from an unexpected production proxy peer; review the deployment ingress path before changing trusted proxy settings",
    );
  }

  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

export default app;
