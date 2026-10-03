const multer = require("multer");
const path = require("path");

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // all images go into the uploads/ folder
  },
  filename: (req, file, cb) => {
    // Build a unique filename so two uploads never overwrite each other
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname); //apple.jpg
    cb(null, uniqueName + ext); // e.g. 1788856108020-472839201.jpg
  },
});

// Only allow image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true); // allow
  } else {
    cb(new Error("Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP)"));
  }
};

// Reusable multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max size
  },
  fileFilter: fileFilter,
});
module.exports = upload;
