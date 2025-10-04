import express from "express";
import {
    getAllUsersForAdmin,
    getUserByIdForAdmin,
    updateUserRole,
    deleteUser,
    getUserStats
} from "../../controllers/user.controller.js";

const router = express.Router();

/**
 * @route   GET /stats
 * @desc    Get user statistics
 * @access  Private (Admin)
 */
router.get("/stats", getUserStats);

/**
 * @route   GET /
 * @desc    Get all users
 * @access  Private (Admin)
 */
router.get("/", getAllUsersForAdmin);

/**
 * @route   GET /:id
 * @desc    Get user by ID
 * @access  Private (Admin)
 */
router.get("/:id", getUserByIdForAdmin);

/**
 * @route   PATCH /:id/role
 * @desc    Update user role
 * @access  Private (Admin)
 */
router.patch("/:id/role", updateUserRole);

/**
 * @route   DELETE /:id
 * @desc    Delete user
 * @access  Private (Admin)
 */
router.delete("/:id", deleteUser);

export default router;
