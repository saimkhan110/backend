require('dotenv').config();
const connectDB = require('./config/db');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();


const PORT = process.env.PORT || 5000;
connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname , 'uploads')));

// ===== Routes =====
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/users', require('./routes/authRoutes')); // auth APIs
app.use('/api/cart', require('./routes/cartRoutes')); // cart APIs (protected)
app.use('/api/orders', require('./routes/orderRoutes')); // order APIs (protected)

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));