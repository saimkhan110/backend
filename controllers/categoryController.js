const Category = require("../models/categoryModel");
const {deleteFile} = require("../utils/fileHelper");

const createCategory = async(req,res)=>{
    try{
        const {name,description} = req.body;
        if(!name){
            return res.status(400).json({
                success:false,
                message:"Category name is required"
            })
        }

        //if an image was uploaded , build its path
        let image = null;
        if(req.file){
            image = 'uploads/' + req.file.filename;
        }
        //create category in database
        const category = await Category.create({
            name,
            description,
            image
        });
        res.status(201).json({
            success:true,
            message:"Category created successfully",
            category
        })

    }
    catch(error){
        if(req.file){
            deleteFile(req.file.filename);
        }
        res.status(400).json({
            success:false,
            message:"Category creation failed",
            error:error.message
        })
    }
}

//read allcategories
const getAllcategories = async(req,res)=>{
    try{
        const categories = await Category.find().sort({createdAt:-1});
        res.json({
            success:true,
            total:categories.length,
            data:categories
        })
    }
    catch(error){
        res.status(500).json({
            success:false,
            message:"Failed to fetch categories",
            error:error.message
        })
    }
}
// Read one category by ID
const getCategoryByID = async (req, res) => {
    try{
       const category =  await Category.findById(req.params.id);

       if(!category){
        return res.status(404).json({
            success:false,
            message:"Category not found"
        })
       }

       res.json({
        success:true,
        data:category
       })
    }
    catch(error){
        res.status(500).json({
            success:false,
            message:"Failed to fetch category",
            error:error.message
        })
    }
    
}

//Update a category
const updateCategory = async(req,res)=>{
    try{
        const {name, description,isActive} = req.body;

        if(!category){
            return res.status(404).json({
                success:false,
                message:"Category not found"
            })
        }
        let image = category.image;
        //if new image uploaded
        if(req.file){
            //delete old image
            if(category.image){
                deleteFile(category.image.replace('uploads/',''));
            }
            image = 'uploads/' + req.file.filename;
        }

        const updateCategory = await Category.findByIdAndUpdate(
            req.params.id,{
                name:name ?? category.name,
                description:description ?? category.description,
                image:image,
                isActive:isActive ?? category.isActive
            },
            {
                new:true,
                runValidators:true
            }
        )

        res.json({
            success:true,
            message:"Category updated successfully",
            category:updateCategory
        })
    }
    catch(error){
        //deleted newly updated file
        if(req.file){
            deleteFile(req.file.filename);
        }
        res.status(500).json({
            success:false,
            message:"Failed to update category",
            error:error.message
        })
    }
}


module.exports = {
    createCategory,
    getAllcategories,
    getCategoryByID,
    updateCategory
}