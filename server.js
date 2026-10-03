require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

const PORT = process.env.PORT || 5000;

app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
const { deleteFile } = require("./utils/fileHelper");

connectDB();

app.listen(PORT, () => console.log(`server started on port ${PORT}`));