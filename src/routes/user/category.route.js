import express from "express";
import {
    getActiveCategories,
    getCategoryById,
    getProductsOfCategory,
} from "../../controllers/category.controller.js";

const router = express.Router();

/**
 * @route   GET /:id
 * @desc    Get Category by id
 * @access  Public
 */
router.get("/:id", getCategoryById);

/**
 * @route   GET /
 * @desc    Create a new category
 * @access  Public
 */
router.get("/", getActiveCategories);

/**
 * @route   GET /:id/products
 * @desc    Get products of a category
 * @access  Public
 */

router.get("/:id/products", getProductsOfCategory);

export default router;


