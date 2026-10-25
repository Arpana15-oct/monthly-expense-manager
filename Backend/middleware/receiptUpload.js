const multer = require("multer");

// Receipt disk pe save nahi hota, seedha memory mein rehta hai aur Gemini ko bhej ke discard ho jaata hai.
const storage = multer.memoryStorage();
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const fileFilter = (req, file, cb) => {
  if (ALLOWED.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPEG, PNG or WEBP images are allowed"), false);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});