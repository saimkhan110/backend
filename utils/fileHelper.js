const fs = require("fs");
const path = require("path");
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const deleteFile = (filename) => {
  if (!filename || filename === 'null') return;
  try {
    // Records contain uploads/name.png; multer gives just name.png.
    const filePath = path.join(UPLOAD_DIR, path.basename(filename));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("File delete error:", error.message);
  }
};

module.exports = { UPLOAD_DIR, deleteFile };
