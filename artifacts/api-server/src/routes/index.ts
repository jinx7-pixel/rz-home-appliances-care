import { Router, type IRouter } from "express";
import healthRouter from "./health";
import repairRequestsRouter from "./repair-requests";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(repairRequestsRouter);
router.use("/auth", authRouter);

export default router;
