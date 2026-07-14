import { Router } from "express";
import { startupsChatRouter } from "./chat";
import {
  startupsCrudDetailRouter,
  startupsCrudListRouter,
} from "./crud";
import { ragDocumentsRouter } from "./ragDocuments";
import { engramPlantRouter } from "./engram";
import {
  connectDbMiddleware,
  requireStartupOwner,
  startupsBaseMiddleware,
} from "./middleware";

export const startupsRouter = Router();

startupsRouter.use(startupsBaseMiddleware[0]);
startupsRouter.use(connectDbMiddleware);

startupsRouter.use(startupsCrudListRouter);

startupsRouter.param("id", requireStartupOwner);

startupsRouter.use(startupsCrudDetailRouter);
startupsRouter.use(engramPlantRouter);
startupsRouter.use(startupsChatRouter);
startupsRouter.use(ragDocumentsRouter);
