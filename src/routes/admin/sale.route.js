import express from "express";
import {
    createSale,
    updateSale,
    deleteSale,
    getSalesForAdmin,
    getSaleByIdForAdmin,
    toggleSaleStatus
} from "../../controllers/sale.controller.js";

const router = express.Router();

/**
 * @route   POST /
 * @desc    Create new sale
 */
router.post("/", createSale);

/**
 * @route   GET /
 * @desc    Get all sales for admin
 */
router.get("/", getSalesForAdmin);

/**
 * @route   GET /:id
 * @desc    Get sale by ID
 */
router.get("/:id", getSaleByIdForAdmin);

/**
 * @route   PUT /:id
 * @desc    Update sale details
 */
router.put("/:id", updateSale);

/**
 * @route   DELETE /:id
 * @desc    Delete a sale
 */
router.delete("/:id", deleteSale);

/**
 * @route   PATCH /:id/toggle
 * @desc    Toggle sale status (active/inactive)
 */
router.patch("/:id/toggle", toggleSaleStatus);

export default router;