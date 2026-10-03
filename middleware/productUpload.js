const multer = require('multer');
const path = require('path');
const { randomUUID } = require('crypto');
const { UPLOAD_DIR } = require('../utils/fileHelper');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname).toLowerCase())
});

const fileFilter = (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg'];
    if (allowed.includes(extension) && ['image/png', 'image/jpeg'].includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only .png, .jpg and .jpeg images are allowed'));
    }
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
