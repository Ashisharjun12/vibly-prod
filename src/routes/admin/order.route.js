import express from 'express';
import {
    getAllOrders,
    getOrderItemsByOrderId,
    updateOrderItemStatus,
    processRefund,
    processReturnCancel
} from '../../controllers/order.controller.js';

const router = express.Router();

// Fetch all orders (paginated & filterable)
router.get('/', getAllOrders);

// Fetch items of a specific order
router.get('/:orderId/items', getOrderItemsByOrderId);

// Update status of a specific item
router.put('/items/:itemId/status', updateOrderItemStatus);

// Cancel a return request for an item
router.post('/items/:itemId/return-cancel', processReturnCancel);

// Process refund for returned item
router.post('/items/:itemId/refund', processRefund);


export default router;