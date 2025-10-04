import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            required: true,
            trim: true,
            maxlength: [500, "Review comment cannot exceed 500 characters"],
        },
        helpful: {
            type: Number,
            default: 0,
        },
        helpfulUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    },
    { timestamps: true }
);

// Add compound index for better query performance
reviewSchema.index({ product: 1, createdAt: -1 });
// Removed unique constraint to allow multiple reviews per user per product

const Review = mongoose.model("Review", reviewSchema);
export default Review;