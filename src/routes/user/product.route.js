import express from "express";
import {
    getAllProducts,
    getProductById,
    searchProducts
} from "../../controllers/product.controller.js";

const router = express.Router();

/**
 * @route   GET /products
 * @desc    Get all active products (optionally filter by category, gender, isOnSale)
 * @access  Public
 */
router.get("/", getAllProducts);

/**
 * @route   GET /products/search
 * @desc    Search products with query parameter
 * @access  Public
 */
router.get("/search", searchProducts);

/**
 * @route   GET /products/:id
 * @desc    Get a single product by ID
 * @access  Public
 */
router.get("/:id", getProductById);

export default router;
