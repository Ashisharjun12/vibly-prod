import { Router } from 'express';
import {
    getOverviewStats,
    getUserStats,
    getProductStats,
    getSalesStats,
    getOrderStats,
    getPaymentStats
} from '../../controllers/stats.controller.js';

const router = Router();

/**
 * @route   GET /overview
 * @desc    Get comprehensive dashboard overview stats
 * @access  Private (Admin)
 */
router.get('/overview', getOverviewStats);

/**
 * @route   GET /users
 * @desc    Get detailed user statistics
 * @access  Private (Admin)
 */
router.get('/users', getUserStats);

/**
 * @route   GET /products
 * @desc    Get detailed product statistics
 * @access  Private (Admin)
 */
router.get('/products', getProductStats);

/**
 * @route   GET /sales
 * @desc    Get detailed sales statistics
 * @access  Private (Admin)
 */
router.get('/sales', getSalesStats);

/**
 * @route   GET /orders
 * @desc    Get detailed order statistics
 * @access  Private (Admin)
 */
router.get('/orders', getOrderStats);

/**
 * @route   GET /payments
 * @desc    Get detailed payment statistics
 * @access  Private (Admin)
 */
router.get('/payments', getPaymentStats);

export default router;