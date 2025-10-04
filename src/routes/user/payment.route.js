import express from 'express';
import {
  getPaymentConfig,
  createPaymentOrder,
  createSimplePayment,
  verifyRazorpayPayment,
  verifyCashfreePayment,
  getPaymentTransactions,
  razorpayWebhook,
  cashfreeWebhook
} from '../../controllers/payment.controller.js';

const router = express.Router();

// Get payment configuration
router.get('/config', getPaymentConfig);

// Create payment order
router.post('/create-order', createPaymentOrder);

// Simple payment endpoint for Cashfree (like your example)
router.post('/simple-payment', createSimplePayment);

// Verify payments
router.post('/verify/razorpay', verifyRazorpayPayment);
router.post('/verify/cashfree', verifyCashfreePayment);

// Get payment transactions
router.get('/transactions/:orderId', getPaymentTransactions);

// Webhook endpoints (no authentication required)
router.post('/razorpay/webhook', razorpayWebhook);
router.post('/cashfree/webhook', cashfreeWebhook);

export default router;
