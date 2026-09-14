import { Router, type IRouter } from "express";
import healthRouter from "./health";
import repairRequestsRouter from "./repair-requests";
import authRouter from "./auth";
import customerRouter from "./customer";

const router: IRouter = Router();

router.use(healthRouter);
router.use(repairRequestsRouter);
router.use("/auth", authRouter);
router.use("/customer", customerRouter);

export default router;
