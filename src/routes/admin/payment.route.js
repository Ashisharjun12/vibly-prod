import express from 'express';
import {
  getAdminPaymentConfig,
  updateAdminPaymentConfig,
  getAllPaymentTransactions,
  getPaymentStats
} from '../../controllers/payment.controller.js';

const router = express.Router();

// Admin payment routes
router.get('/config', getAdminPaymentConfig);
router.put('/config', updateAdminPaymentConfig);
router.get('/transactions', getAllPaymentTransactions);
router.get('/stats', getPaymentStats);

export default router;
