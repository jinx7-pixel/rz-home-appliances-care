import { Router, type IRouter } from "express";
import healthRouter from "./health";
import repairRequestsRouter from "./repair-requests";

const router: IRouter = Router();

router.use(healthRouter);
router.use(repairRequestsRouter);

export default router;
