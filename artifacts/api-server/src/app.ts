import express, {
  type ErrorRequestHandler,
  type Express,
  type Request,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.disable("x-powered-by");

// API responses are dynamic and several authenticated dashboard reads must
// always include their JSON body. Avoid conditional 304 responses being
// mistaken for an empty API payload by browser fetch callers.
app.set("etag", false);

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

app.use((_request, response, next) => {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  if (process.env.NODE_ENV === "production") {
    response.setHeader("Strict-Transport-Security", "max-age=31536000");
  }

  next();
});

function getConfiguredFrontendOrigin(): string | undefined {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  if (!configuredBaseUrl) return undefined;

  try {
    const url = new URL(configuredBaseUrl);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function getRequestOrigin(request: Request): string | undefined {
  const host = request.get("host");
  if (!host) return undefined;

  try {
    return new URL(`${request.protocol}://${host}`).origin;
  } catch {
    return undefined;
  }
}

function isAllowedAdminMutationOrigin(
  origin: string | undefined,
  request: Request,
): boolean {
  const requestOrigin = getRequestOrigin(request);
  return Boolean(origin && requestOrigin && origin === requestOrigin);
}

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
app.use(
  cors({
    origin(origin, callback) {
      const configuredOrigin = getConfiguredFrontendOrigin();
      callback(
        null,
        origin && configuredOrigin && origin === configuredOrigin
          ? origin
          : false,
      );
    },
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Idempotency-Key"],
  }),
);
app.use("/api/admin", (request, response, next) => {
  if (!["POST", "PATCH", "DELETE"].includes(request.method)) {
    next();
    return;
  }

  if (!isAllowedAdminMutationOrigin(request.get("origin"), request)) {
    response.status(403).json({
      error: "Cross-origin admin requests are not allowed.",
    });
    return;
  }

  next();
});
app.use(express.json({ limit: "32kb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "32kb",
    parameterLimit: 100,
  }),
);
app.use(cookieParser());

app.use("/api", router);

export const apiErrorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const errorType =
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof error.type === "string"
      ? error.type
      : undefined;
  const errorStatus =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : undefined;

  if (errorType === "entity.too.large" || errorStatus === 413) {
    response.status(413).json({ error: "Request body is too large." });
    return;
  }

  if (errorType === "entity.parse.failed") {
    response.status(400).json({ error: "Invalid request body." });
    return;
  }

  if (errorStatus && errorStatus >= 400 && errorStatus < 500) {
    response.status(errorStatus).json({ error: "Invalid request." });
    return;
  }

  request.log.error({ err: error }, "Unhandled API error");
  response
    .status(500)
    .json({ error: "An unexpected server error occurred." });
};

app.use(apiErrorHandler);

export default app;
