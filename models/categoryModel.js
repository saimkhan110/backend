const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name:{
        type:String,
        required:[true,'Category name is required'],
        unique:true,
        trim:true
    },
    description:{
        type:String,
        default : '',     
        trim:true
    },
    image:{
        type:String,
        default : 'null',
      
    },
    isActive:{
        type:Boolean,
        default : true
    }},
     {
timestamps: true     
});

const category = mongoose.model('Category',CategorySchema);

module.exports = category