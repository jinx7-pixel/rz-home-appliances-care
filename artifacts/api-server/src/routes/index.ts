import { Router, type IRouter } from "express";
import healthRouter from "./health";
import repairRequestsRouter from "./repair-requests";
import authRouter from "./auth";
import customerRouter from "./customer";
import bookingsRouter from "./bookings";
import adminAuthRouter from "./admin-auth";
import adminRepairRequestsRouter from "./admin-repair-requests";

const router: IRouter = Router();

router.use(healthRouter);
router.use(repairRequestsRouter);
router.use("/auth", authRouter);
router.use("/customer", customerRouter);
router.use("/customer", bookingsRouter);
router.use("/admin", adminAuthRouter);
router.use("/admin", adminRepairRequestsRouter);

export default router;
