const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
createCategory,
getAllcategories,
getCategoryByID,
updateCategory
} = require('../controllers/categoryController');
                           
                           

router.get('/', getAllcategories);
router.post('/', upload.single('image'), createCategory);
router.get('/:id', getCategoryByID); 
router.put('/:id', upload.single('image'), updateCategory);       
                         
module.exports = router;