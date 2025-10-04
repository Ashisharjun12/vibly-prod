import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Category name is required"],
            trim: true,
        },
        gender: {
            type: String,
            required: [true, "Gender is required"],
            enum: ["men", "women", "unisex"],
        },
        isActive: {
            type: Boolean,
            default:true
        },
    },
    {
        timestamps: true,
    }
);

const Category = mongoose.model("Category", categorySchema);
export default Category;
