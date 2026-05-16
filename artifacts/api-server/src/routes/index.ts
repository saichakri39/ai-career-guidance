import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import resumeRouter from "./resume";
import predictionsRouter from "./predictions";
import suggestionsRouter from "./suggestions";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(resumeRouter);
router.use(predictionsRouter);
router.use(suggestionsRouter);
router.use(dashboardRouter);

export default router;
