const express = require("express");
const { chat, receipt } = require("../controllers/buddyControllers.js");
const receiptUpload = require("../middleware/receiptUpload.js");
const { protect } = require("../middleware/authMiddleware.js");
const router = express.Router();

router.post("/chat", protect, chat);
router.post("/receipt", protect, receiptUpload.single("receipt"), receipt);

module.exports = router;