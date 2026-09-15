import { Router, type IRouter } from "express";
import healthRouter from "./health";
import repairRequestsRouter from "./repair-requests";
import authRouter from "./auth";
import customerRouter from "./customer";
import bookingsRouter from "./bookings";
import adminAuthRouter from "./admin-auth";
import adminRepairRequestsRouter from "./admin-repair-requests";
import adminBookingsRouter from "./admin-bookings";
import reviewsRouter from "./reviews";
import siteStatusRouter, { isWebsiteEnabled } from "./site-status";

const router: IRouter = Router();

router.use(healthRouter);
router.use(async (request, response, next) => {
  const isAdminRoute = request.path === "/admin" || request.path.startsWith("/admin/");
  const isAvailabilityRoute =
    request.path === "/site-status" || request.path === "/healthz";

  if (isAdminRoute || isAvailabilityRoute) {
    next();
    return;
  }

  try {
    if (!(await isWebsiteEnabled())) {
      response.status(503).json({
        code: "WEBSITE_OFFLINE",
        error: "The website is temporarily unavailable.",
      });
      return;
    }
  } catch {
    response.status(503).json({
      code: "WEBSITE_OFFLINE",
      error: "The website is temporarily unavailable.",
    });
    return;
  }

  next();
});
router.use(siteStatusRouter);
router.use(repairRequestsRouter);
router.use("/auth", authRouter);
router.use("/customer", customerRouter);
router.use("/customer", bookingsRouter);
router.use("/admin", adminAuthRouter);
router.use("/admin", adminRepairRequestsRouter);
router.use("/admin", adminBookingsRouter);
router.use(reviewsRouter);

export default router;
