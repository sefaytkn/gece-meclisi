import { Router } from "express";
import { prisma } from "../prisma/client.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const games = await prisma.game.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    res.json({ success: true, data: { games } });
  } catch (error) {
    next(error);
  }
});

export default router;
