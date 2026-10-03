const express = require('express');
const cors = require('cors');
const { UPLOAD_DIR, deleteFile } = require('./utils/fileHelper');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((error, req, res, next) => {
    if (req.file) deleteFile(req.file.filename);
    const badRequest = error.name === 'ValidationError' || error.name === 'CastError' || error.name === 'MulterError' || error.message.startsWith('Only .png') || error.status === 400 || error.type === 'entity.parse.failed';
    res.status(error.code === 11000 ? 409 : badRequest ? 400 : error.status === 413 ? 413 : 500).json({ success: false, message: error.message });
});

module.exports = app;

