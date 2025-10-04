import express from 'express';
import {
  createOrder,
  getUserOrders,
  getOrderByOrderId,
  cancelOrderItem,
  returnOrderItem,
} from '../../controllers/order.controller.js';

const router = express.Router();

router.post('/', createOrder);
router.get('/', getUserOrders);
router.get('/:orderId', getOrderByOrderId);
router.put('/cancel', cancelOrderItem);
router.put('/return', returnOrderItem);
router.put('/return-cancel', returnOrderItem);

export default router;
