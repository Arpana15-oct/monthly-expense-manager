const express = require("express");
const { addGoal, getGoals, replanGoal, deleteGoal } = require("../controllers/goalControllers.js");
const { protect } = require("../middleware/authMiddleware.js");
const router = express.Router();

router.post("/add", protect, addGoal);
router.get("/get", protect, getGoals);
router.post("/:id/replan", protect, replanGoal);
router.delete("/:id", protect, deleteGoal);

module.exports = router;