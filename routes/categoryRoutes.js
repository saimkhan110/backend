const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  createCategory,
  getAllcategories,
  getCategoryByID,
  updateCategory,
  deleteCategory,              // FIX 4: naya function
} = require('../controllers/categoryController');

router.get('/', getAllcategories);
router.post('/', upload.single('image'), createCategory);
router.get('/:id', getCategoryByID);
router.put('/:id', upload.single('image'), updateCategory);
router.delete('/:id', deleteCategory);   // FIX 4: DELETE route

module.exports = router;
