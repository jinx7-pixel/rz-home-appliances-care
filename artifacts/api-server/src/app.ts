import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// The deployed application router is the only public ingress and forwards to
// this service over the local loopback interface. Trust only those exact
// addresses so a request from any other peer cannot choose its identity with
// X-Forwarded-For. Do not replace this with `true` or a hop count: both would
// allow a directly connected client to spoof the forwarded address.
app.set("trust proxy", ["127.0.0.1/32", "::1/128"]);

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
