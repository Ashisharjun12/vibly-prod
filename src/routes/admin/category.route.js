import express from "express";
import {
    createCategory,
    deleteCategory,
    getCategoriesForAdmin,
    toggleCategoryStatus,
    updateCategory,
} from "../../controllers/category.controller.js";

const router = express.Router();

/**
 * @route   GET /
 * @desc    Get all categories
 * @access  Private (Admin)
 */
router.get("/", getCategoriesForAdmin);

/**
 * @route   POST /
 * @desc    Create a new category
 * @access  Private (Admin)
 */
router.post("/", createCategory);

/**
 * @route   PATCH /:id
 * @desc    Update a category
 * @access  Private (Admin)
 */
router.patch("/:id", updateCategory);

/**
 * @route   DELETE /:id
 * @desc    Delete a category
 * @access  Private (Admin)
 */
router.delete("/:id", deleteCategory);


/**
 * @route   PUT /:id/toggle
 * @desc    Toggle a category's status
 * @access  Private (Admin)
 */
router.put("/:id/toggle", toggleCategoryStatus);

export default router;

