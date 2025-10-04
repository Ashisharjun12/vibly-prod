import express from 'express';
import { addReview, getReviews, updateReview, deleteReview, markHelpful } from '../controllers/review.controller.js';
import { authMiddleware } from '../middleware/authMiddleware.js';


const router = express.Router();



// Add a review (requires authentication)
router.post('/:productId', authMiddleware, addReview);

// Get reviews for a product (public)
router.get('/:productId', getReviews);

// Update a review (requires authentication)
router.patch('/:productId/:reviewId', authMiddleware, updateReview);

// Delete a review (requires authentication)
router.delete('/:productId/:reviewId', authMiddleware, deleteReview);

// Mark review as helpful (requires authentication)
router.post('/:productId/:reviewId/helpful', authMiddleware, markHelpful);

export default router;
