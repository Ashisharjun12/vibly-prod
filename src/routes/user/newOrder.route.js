import express from 'express';
import {
    createOrder,
    getUserOrders,
    getOrderByOrderId,
    cancelOrderItem,
    returnOrderItem,
    getUserAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    requestRefund,
    getUserRefundRequests,
} from '../../controllers/newOrder.controller.js';

const router = express.Router();

router.post('/', createOrder);
router.get('/', getUserOrders);

// Address routes (must come before dynamic routes)
router.get('/addresses', getUserAddresses);
router.post('/addresses', addAddress);
router.put('/addresses/:addressId', updateAddress);
router.delete('/addresses/:addressId', deleteAddress);
router.put('/addresses/:addressId/default', setDefaultAddress);

// Refund routes (must come before dynamic routes)
router.post('/refund/request', requestRefund);
router.get('/refund/requests', getUserRefundRequests);

// Order routes (distribution routes come last)
router.get('/:orderId', getOrderByOrderId);
router.put('/cancel', cancelOrderItem);
router.put('/return', returnOrderItem);
router.put('/return-cancel', returnOrderItem);

export default router;
