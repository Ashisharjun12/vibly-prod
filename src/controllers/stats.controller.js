import mongoose from "mongoose";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Sale from "../models/sale.model.js";
import { NewOrder } from "../models/newOrder.model.js";
import { PaymentTransaction } from "../models/paymentTransaction.model.js";

/**
 * @route   GET /admin/stats/overview
 * @desc    Get comprehensive dashboard overview stats
 * @access  Private (Admin)
 */
export const getOverviewStats = async (req, res) => {
    try {
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(200).json({
                success: true,
                data: {
                    users: { total: 0, admins: 0, regular: 0, recent: 0 },
                    products: { total: 0, active: 0, inactive: 0, recent: 0 },
                    sales: { total: 0, active: 0, scheduled: 0, totalProducts: 0 },
                    orders: { total: 0, pending: 0, completed: 0, processing: 0 },
                    payments: { total: 0, success: 0, failed: 0, pending: 0 },
                    revenue: { total: 0, monthly: 0, growth: 0 }
                }
            });
        }

        // Get basic counts
        const [
            totalUsers,
            adminUsers,
            regularUsers,
            recentUsers,
            totalProducts,
            activeProducts,
            inactiveProducts,
            recentProducts,
            totalSales,
            totalOrders,
            totalPayments
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'Admin' }),
            User.countDocuments({ role: 'User' }),
            User.countDocuments({ 
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
            }),
            Product.countDocuments(),
            Product.countDocuments({ isActive: true }),
            Product.countDocuments({ isActive: false }),
            Product.countDocuments({ 
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
            }),
            Sale.countDocuments(),
            NewOrder.countDocuments(),
            PaymentTransaction.countDocuments()
        ]);

        // Get sales data
        const sales = await Sale.find().populate('products', 'name');
        const now = new Date();
        const activeSales = sales.filter(sale => {
            const start = new Date(sale.startDate);
            const end = new Date(sale.endDate);
            return sale.isActive && now >= start && now <= end;
        });
        const scheduledSales = sales.filter(sale => new Date(sale.startDate) > now);
        const totalProductsInSales = sales.reduce((total, sale) => total + sale.products.length, 0);

        // Get orders data
        const orders = await NewOrder.find();
        const orderStats = {
            total: orders.length,
            pending: orders.filter(order => order.paymentStatus === 'PENDING').length,
            completed: orders.filter(order => order.paymentStatus === 'PAID').length,
            processing: orders.filter(order => order.paymentStatus === 'PROCESSING').length
        };

        // Get payment data
        const payments = await PaymentTransaction.find();
        const paymentStats = {
            total: payments.length,
            success: payments.filter(p => p.status === 'success').length,
            failed: payments.filter(p => p.status === 'failed').length,
            pending: payments.filter(p => p.status === 'pending').length
        };

        // Calculate revenue
        const successfulPayments = payments.filter(p => p.status === 'success');
        const totalRevenue = successfulPayments.reduce((sum, payment) => sum + payment.amount, 0);
        
        // Monthly revenue (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const monthlyPayments = successfulPayments.filter(p => p.completedAt >= thirtyDaysAgo);
        const monthlyRevenue = monthlyPayments.reduce((sum, payment) => sum + payment.amount, 0);

        // Revenue growth calculation (mock for now)
        const revenueGrowth = 12.5; // This could be calculated from historical data

        return res.status(200).json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    admins: adminUsers,
                    regular: regularUsers,
                    recent: recentUsers
                },
                products: {
                    total: totalProducts,
                    active: activeProducts,
                    inactive: inactiveProducts,
                    recent: recentProducts
                },
                sales: {
                    total: totalSales,
                    active: activeSales.length,
                    scheduled: scheduledSales.length,
                    totalProducts: totalProductsInSales
                },
                orders: orderStats,
                payments: paymentStats,
                revenue: {
                    total: totalRevenue,
                    monthly: monthlyRevenue,
                    growth: revenueGrowth
                }
            }
        });

    } catch (error) {
        console.error("Error in getOverviewStats:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch overview stats",
            error: error.message
        });
    }
};

/**
 * @route   GET /admin/stats/users
 * @desc    Get detailed user statistics
 * @access  Private (Admin)
 */
export const getUserStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: 'Admin' });
        const regularUsers = await User.countDocuments({ role: 'User' });

        // Get recent users (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentUsers = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        // Get users by month for chart data
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const monthlyUsers = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: {
                total: totalUsers,
                admins: adminUsers,
                users: regularUsers,
                recent: recentUsers,
                monthlyData: monthlyUsers
            }
        });
    } catch (err) {
        console.error('Error fetching user stats:', err);
        return res.status(500).json({ 
            message: "Failed to fetch user statistics", 
            error: err.message 
        });
    }
};

/**
 * @route   GET /admin/stats/products
 * @desc    Get detailed product statistics
 * @access  Private (Admin)
 */
export const getProductStats = async (req, res) => {
    try {
        // Get basic counts
        const [
            totalProducts,
            activeProducts,
            inactiveProducts,
            recentProducts
        ] = await Promise.all([
            Product.countDocuments(),
            Product.countDocuments({ isActive: true }),
            Product.countDocuments({ isActive: false }),
            Product.countDocuments({ 
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
            })
        ]);

        // Get category distribution
        let categoryStats = [];
        try {
            categoryStats = await Product.aggregate([
                {
                    $lookup: {
                        from: "categories",
                        localField: "category",
                        foreignField: "_id",
                        as: "categoryInfo"
                    }
                },
                {
                    $unwind: {
                        path: "$categoryInfo",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $group: {
                        _id: { $ifNull: ["$categoryInfo.name", "Unknown"] },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);
        } catch (aggregationError) {
            console.error("Category aggregation error:", aggregationError);
            categoryStats = [];
        }

        return res.status(200).json({
            success: true,
            data: {
                totalProducts,
                activeProducts,
                inactiveProducts,
                recentProducts,
                categoryStats
            }
        });

    } catch (error) {
        console.error("Error in getProductStats:", error);
        return res.status(500).json({
            message: "Failed to fetch product statistics",
            error: error.message
        });
    }
};

/**
 * @route   GET /admin/stats/sales
 * @desc    Get detailed sales statistics
 * @access  Private (Admin)
 */
export const getSalesStats = async (req, res) => {
    try {
        const sales = await Sale.find().populate('products', 'name variants');
        
        const now = new Date();
        const activeSales = sales.filter(sale => {
            const start = new Date(sale.startDate);
            const end = new Date(sale.endDate);
            return sale.isActive && now >= start && now <= end;
        });
        
        const scheduledSales = sales.filter(sale => new Date(sale.startDate) > now);
        const expiredSales = sales.filter(sale => new Date(sale.endDate) < now);
        
        const totalProductsInSales = sales.reduce((total, sale) => total + sale.products.length, 0);

        return res.status(200).json({
            success: true,
            data: {
                total: sales.length,
                active: activeSales.length,
                scheduled: scheduledSales.length,
                expired: expiredSales.length,
                totalProducts: totalProductsInSales
            }
        });

    } catch (error) {
        console.error("Error in getSalesStats:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch sales statistics",
            error: error.message
        });
    }
};

/**
 * @route   GET /admin/stats/orders
 * @desc    Get detailed order statistics
 * @access  Private (Admin)
 */
export const getOrderStats = async (req, res) => {
    try {
        const orders = await NewOrder.find();
        
        const orderStats = {
            total: orders.length,
            pending: orders.filter(order => order.paymentStatus === 'PENDING').length,
            paid: orders.filter(order => order.paymentStatus === 'PAID').length,
            failed: orders.filter(order => order.paymentStatus === 'FAILED').length,
            refunded: orders.filter(order => order.paymentStatus === 'REFUNDED').length
        };

        // Calculate total revenue
        const paidOrders = orders.filter(order => order.paymentStatus === 'PAID');
        const totalRevenue = paidOrders.reduce((sum, order) => {
            return sum + order.items.reduce((itemSum, item) => itemSum + item.amount.totalAmount, 0);
        }, 0);

        return res.status(200).json({
            success: true,
            data: {
                ...orderStats,
                totalRevenue
            }
        });

    } catch (error) {
        console.error("Error in getOrderStats:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch order statistics",
            error: error.message
        });
    }
};

/**
 * @route   GET /admin/stats/payments
 * @desc    Get detailed payment statistics
 * @access  Private (Admin)
 */
export const getPaymentStats = async (req, res) => {
    try {
        const payments = await PaymentTransaction.find();
        
        const paymentStats = {
            total: payments.length,
            success: payments.filter(p => p.status === 'success').length,
            failed: payments.filter(p => p.status === 'failed').length,
            pending: payments.filter(p => p.status === 'pending').length,
            cancelled: payments.filter(p => p.status === 'cancelled').length,
            refunded: payments.filter(p => p.status === 'refunded').length
        };

        // Calculate revenue by provider
        const successfulPayments = payments.filter(p => p.status === 'success');
        const revenueByProvider = successfulPayments.reduce((acc, payment) => {
            const provider = payment.provider;
            if (!acc[provider]) {
                acc[provider] = 0;
            }
            acc[provider] += payment.amount;
            return acc;
        }, {});

        return res.status(200).json({
            success: true,
            data: {
                ...paymentStats,
                revenueByProvider
            }
        });

    } catch (error) {
        console.error("Error in getPaymentStats:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment statistics",
            error: error.message
        });
    }
};
