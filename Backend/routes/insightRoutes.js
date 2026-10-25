const express = require("express");
const { getSuggestions } = require("../controllers/insightControllers.js");
const { protect } = require("../middleware/authMiddleware.js");
const router = express.Router();

router.get("/suggestions", protect, getSuggestions);

module.exports = router;