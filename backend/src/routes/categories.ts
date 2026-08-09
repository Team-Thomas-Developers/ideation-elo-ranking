import { Router } from "express";
import { CATEGORIES } from "../lib/categories";

const router = Router();

// get /api/categories — the fixed list of categories ideas are ranked on
router.get("/", (_req, res) => {
  res.json(
    [...CATEGORIES]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ id: c.id, label: c.label })),
  );
});

export default router;
