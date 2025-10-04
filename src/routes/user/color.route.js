import express from "express";
import { getActiveColors, getProductsOfColor } from "../../controllers/color.controller.js";


const router = express.Router();

/**
 * @route   GET /
 * @desc    Get all active colors
 * @access  Private (Admin)
 */
router.get("/", getActiveColors);

/**
 * @route   GET /:id
 * @desc    Get color by ID
 * @access  Private (Admin)
 */
router.get("/:id", getProductsOfColor);


export default router;