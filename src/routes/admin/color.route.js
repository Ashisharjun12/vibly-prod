import express from "express";
import {
    getColorsForAdmin,
    createColor,
    updateColor,
    deleteColor,
    toggleColorStatus,
    getProductsOfColorForAdmin,
} from "../../controllers/color.controller.js";


const router = express.Router();

/**
 * @route   GET /
 * @desc    Get all colors (with isActive filter)
 * @access  Private (Admin)
 */
router.get("/", getColorsForAdmin);

/**
 * @route   GET /color=:color
 * @desc    Get products of a color
 * @access  Private (Admin)
 */
router.get("/color=:color", getProductsOfColorForAdmin);

/**
 * @route   POST /
 * @desc    Create a new color
 * @access  Private (Admin)
 */
router.post("/", createColor);

/**
 * @route   PUT /:id
 * @desc    Update a color
 * @access  Private (Admin)
 */
router.put("/:id", updateColor);

/**
 * @route   DELETE /:id
 * @desc    Delete a color
 * @access  Private (Admin)
 */
router.delete("/:id", deleteColor);

/**
 * @route   PUT /:id/toggle
 * @desc    Toggle a color's status
 * @access  Private (Admin)
 */
router.put("/:id/toggle", toggleColorStatus);

export default router;
