import User from "../models/user.model.js";
import mongoose from "mongoose";

/**
 * @route   GET /admin/users
 * @desc    Get all users for admin
 * @access  Private (Admin)
 */
export const getAllUsersForAdmin = async (req, res) => {
    try {
        const { role, search, page = 1, limit = 10 } = req.query;
        let filter = {};

        // Filter by role if provided
        if (role && role !== 'all') {
            filter.role = role;
        }

        // Search by name or email if provided
        if (search) {
            filter.$or = [
                { firstname: { $regex: search, $options: 'i' } },
                { lastname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Parse pagination parameters
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination
        const totalUsers = await User.countDocuments(filter);

        // Get users with pagination
        const users = await User.find(filter)
            .select('-googleId -cartList -orderList -productsViewed')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        // Calculate pagination info
        const totalPages = Math.ceil(totalUsers / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        return res.status(200).json({ 
            data: users,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalUsers,
                limit: limitNum,
                hasNextPage,
                hasPrevPage
            }
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ 
            message: "Failed to fetch users", 
            error: err.message 
        });
    }
};

/**
 * @route   GET /admin/users/:id
 * @desc    Get user by ID for admin
 * @access  Private (Admin)
 */
export const getUserByIdForAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const user = await User.findById(id)
            .select('-googleId -cartList -orderList -productsViewed');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ data: user });
    } catch (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json({ 
            message: "Failed to fetch user", 
            error: err.message 
        });
    }
};

/**
 * @route   PATCH /admin/users/:id/role
 * @desc    Update user role
 * @access  Private (Admin)
 */
export const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        if (!role || !['User', 'Admin'].includes(role)) {
            return res.status(400).json({ message: "Invalid role. Must be 'User' or 'Admin'" });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Prevent admin from changing their own role
        if (user._id.toString() === req.user) {
            return res.status(400).json({ message: "Cannot change your own role" });
        }

        user.role = role;
        await user.save();

        return res.status(200).json({
            message: `User role updated to ${role}`,
            data: {
                id: user._id,
                name: user.fullName,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Error updating user role:', err);
        return res.status(500).json({ 
            message: "Failed to update user role", 
            error: err.message 
        });
    }
};

/**
 * @route   DELETE /admin/users/:id
 * @desc    Delete user (soft delete by deactivating)
 * @access  Private (Admin)
 */
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid user ID" });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Prevent admin from deleting themselves
        if (user._id.toString() === req.user) {
            return res.status(400).json({ message: "Cannot delete your own account" });
        }

        // Soft delete - we'll add an isActive field to the user model
        // For now, we'll just delete the user
        await User.findByIdAndDelete(id);

        return res.status(200).json({
            message: "User deleted successfully"
        });
    } catch (err) {
        console.error('Error deleting user:', err);
        return res.status(500).json({ 
            message: "Failed to delete user", 
            error: err.message 
        });
    }
};

/**
 * @route   GET /admin/users/stats
 * @desc    Get user statistics
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

        return res.status(200).json({
            data: {
                total: totalUsers,
                admins: adminUsers,
                users: regularUsers,
                recent: recentUsers
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
