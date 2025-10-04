import express from "express";
import { getActiveBanners } from "../../controllers/banners.controller.js";

const router = express.Router();

/**
 * @route   GET /admin/banners?isActive=true|false|all
 * @desc    Get all banners, or filtered by active status
 * @access  Private (Admin)
 */
router.get("/", getActiveBanners);


export default router;