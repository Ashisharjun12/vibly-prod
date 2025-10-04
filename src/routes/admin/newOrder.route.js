import express from 'express';
import {
    getAllOrders,
    getOrderItemsByOrderId,
    updateOrderItemStatus,
    processRefund,
    processReturnCancel,
    getAllReturnRequests,
    getReturnRequestDetails,
    updateReturnRequestStatus,
    getAllRefundRequests,
    approveRefundRequest,
    rejectRefundRequest
} from '../../controllers/newOrder.controller.js';

const router = express.Router();

// Fetch all orders (paginated & filterable)
router.get('/', getAllOrders);

// Fetch items of a specific order
router.get('/:orderId/items', getOrderItemsByOrderId);

// Update status of a specific item
router.put('/items/status', updateOrderItemStatus);

// Cancel a return request for an item
router.put('/items/return-cancel', processReturnCancel);

// Process refund for returned item
router.put('/items/refund', processRefund);

// Get all return requests
router.get('/returns', getAllReturnRequests);

// Get return request details
router.get('/returns/:returnId', getReturnRequestDetails);

// Update return request status
router.put('/returns/:returnId/status', updateReturnRequestStatus);

// Refund management routes
router.get('/refunds', getAllRefundRequests);
router.put('/refunds/:refundRequestId/approve', approveRefundRequest);
router.put('/refunds/:refundRequestId/reject', rejectRefundRequest);

export default router;