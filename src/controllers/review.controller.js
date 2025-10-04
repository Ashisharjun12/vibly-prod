import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Review from "../models/review.model.js";

// Add a review
export const addReview = async (req, res) => {
    try {
        const userId = req.user;
        const { rating, comment } = req.body;
        const { productId } = req.params;

        if (!userId) {
            return res.status(401).json({ message: "Please log in to add a review." });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: "Invalid product ID." });
        }

        if (!rating || ![1, 2, 3, 4, 5].includes(Number(rating))) {
            return res.status(400).json({ message: "Rating must be between 1 and 5." });
        }

        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ message: "Please provide a comment." });
        }

        if (comment.length > 500) {
            return res.status(400).json({ message: "Comment cannot exceed 500 characters." });
        }

        const product = await Product.findOne({ _id: productId, isActive: true });
        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        const newReview = await Review.create({
            user: userId,
            product: productId,
            rating: Number(rating),
            comment: comment.trim()
        });

        // Recalculate product ratings
        const reviews = await Review.find({ product: productId });
        const averageRating = reviews.length > 0 
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
            : 0;

        await Product.findByIdAndUpdate(productId, {
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: reviews.length
        });

        res.status(201).json({
            message: "Review added successfully.",
            review: newReview
        });
    } catch (error) {
        console.error("Add Review Error:", error);
        return res.status(500).json({ message: "Failed to add review", error: error.message });
    }
};

// Get reviews for a product
export const getReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const { page = 1, limit = 10, rating, sort = 'newest' } = req.query;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: "Invalid product ID." });
        }

        const product = await Product.findOne({ _id: productId, isActive: true });
        if (!product) {
            return res.status(404).json({ message: "Product not found." });
        }

        let reviewQuery = { product: productId };
        if (rating) {
            reviewQuery.rating = Number(rating);
        }

        let sortQuery = {};
        switch (sort) {
            case 'newest':
                sortQuery = { createdAt: -1 };
                break;
            case 'oldest':
                sortQuery = { createdAt: 1 };
                break;
            case 'highest':
                sortQuery = { rating: -1 };
                break;
            case 'lowest':
                sortQuery = { rating: 1 };
                break;
            default:
                sortQuery = { createdAt: -1 };
        }

        const reviews = await Review.find(reviewQuery)
            .populate('user', 'firstname lastname email profile')
            .sort(sortQuery)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalReviews = await Review.countDocuments(reviewQuery);
        const totalPages = Math.ceil(totalReviews / limit);

        // Calculate average rating and rating distribution
        const allReviews = await Review.find({ product: productId });
        const averageRating = allReviews.length > 0 
            ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length 
            : 0;

        const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
            rating,
            count: allReviews.filter(r => r.rating === rating).length
        }));

        res.json({
            success: true,
            data: {
                reviews,
                pagination: {
                    currentPage: Number(page),
                    totalPages,
                    totalReviews,
                    limit: Number(limit)
                },
                averageRating: Math.round(averageRating * 10) / 10,
                totalReviews,
                ratingDistribution
            }
        });
    } catch (error) {
        console.error("Get Reviews Error:", error);
        return res.status(500).json({ message: "Failed to get reviews", error: error.message });
    }
};

// Update a review
export const updateReview = async (req, res) => {
    try {
        const userId = req.user;
        const { productId, reviewId } = req.params;
        const { rating, comment } = req.body;

        if (!userId) {
            return res.status(401).json({ message: "Please log in to update a review." });
        }

        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ message: "Invalid product or review ID." });
        }

        if (rating && ![1, 2, 3, 4, 5].includes(Number(rating))) {
            return res.status(400).json({ message: "Rating must be between 1 and 5." });
        }

        if (comment && comment.trim().length === 0) {
            return res.status(400).json({ message: "Comment cannot be empty." });
        }

        if (comment && comment.length > 500) {
            return res.status(400).json({ message: "Comment cannot exceed 500 characters." });
        }

        const review = await Review.findOne({ _id: reviewId, user: userId, product: productId });
        if (!review) {
            return res.status(404).json({ message: "Review not found or unauthorized." });
        }

        const updateData = {};
        if (rating) updateData.rating = Number(rating);
        if (comment) updateData.comment = comment.trim();

        const updatedReview = await Review.findByIdAndUpdate(
            reviewId,
            updateData,
            { new: true }
        );

        // Recalculate product ratings
        const reviews = await Review.find({ product: productId });
        const averageRating = reviews.length > 0 
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
            : 0;

        await Product.findByIdAndUpdate(productId, {
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: reviews.length
        });

        res.json({
            message: "Review updated successfully.",
            review: updatedReview
        });
    } catch (error) {
        console.error("Update Review Error:", error);
        return res.status(500).json({ message: "Failed to update review", error: error.message });
    }
};

// Delete a review
export const deleteReview = async (req, res) => {
    try {
        const userId = req.user;
        const { productId, reviewId } = req.params;

        if (!userId) {
            return res.status(401).json({ message: "Please log in to delete a review." });
        }

        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ message: "Invalid product or review ID." });
        }

        const review = await Review.findOne({ _id: reviewId, user: userId, product: productId });
        if (!review) {
            return res.status(404).json({ message: "Review not found or unauthorized." });
        }

        await Review.findByIdAndDelete(reviewId);

        // Recalculate product ratings
        const reviews = await Review.find({ product: productId });
        const averageRating = reviews.length > 0 
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
            : 0;

        await Product.findByIdAndUpdate(productId, {
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: reviews.length
        });

        res.json({ message: "Review deleted successfully." });
    } catch (error) {
        console.error("Delete Review Error:", error);
        return res.status(500).json({ message: "Failed to delete review", error: error.message });
    }
};

// Mark review as helpful
export const markHelpful = async (req, res) => {
    try {
        const userId = req.user;
        const { productId, reviewId } = req.params;

        if (!userId) {
            return res.status(401).json({ message: "Please log in to mark review as helpful." });
        }

        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ message: "Invalid product or review ID." });
        }

        const review = await Review.findOne({ _id: reviewId, product: productId });
        if (!review) {
            return res.status(404).json({ message: "Review not found." });
        }

        const isAlreadyHelpful = review.helpfulUsers.includes(userId);

        if (isAlreadyHelpful) {
            // Remove helpful vote
            review.helpfulUsers.pull(userId);
            review.helpful = Math.max(0, review.helpful - 1);
        } else {
            // Add helpful vote
            review.helpfulUsers.push(userId);
            review.helpful += 1;
        }

        await review.save();

        res.json({ 
            message: isAlreadyHelpful ? "Removed helpful vote" : "Marked as helpful",
            helpful: review.helpful,
            isHelpful: !isAlreadyHelpful
        });
    } catch (error) {
        console.error("Error marking review as helpful:", error);
        res.status(500).json({ message: "Failed to mark review as helpful." });
    }
};