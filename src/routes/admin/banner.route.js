import express from "express";
import { deleteBanner, getBannersForAdmin, reorderBanners, toggleBannerStatus, toggleBannerSaleStatus, uploadBanner } from "../../controllers/banners.controller.js";
import { upload } from "../../middleware/multer.js";

const router = express.Router();

/**
 * @route   GET /admin/banners?isActive=true|false|all
 * @desc    Get all banners, or filtered by active status
 * @access  Private (Admin)
 */
router.get("/", getBannersForAdmin);

/**
 * @route   POST /admin/banners/upload
 * @desc    Upload a banner
 * @access  Private (Admin)
 */
router.post("/upload", upload, uploadBanner);

/**
 * @route   PATCH /admin/banners/:id/toggle
 * @desc    Toggle a banner's status
 * @access  Private (Admin)
 */
router.patch("/:id/toggle", toggleBannerStatus);

/**
 * @route   PATCH /admin/banners/:id/toggle-sale
 * @desc    Toggle a banner's sale active status
 * @access  Private (Admin)
 */
router.patch("/:id/toggle-sale", toggleBannerSaleStatus);

/**
 * @route   PUT /admin/banners/reorder/all
 * @desc    Reorder all banners
 * @access  Private (Admin)
 */
router.put("/reorder/all", reorderBanners);

/**
 * @route   DELETE /admin/banners/:id
 * @desc    Delete a banner
 * @access  Private (Admin)
 */
router.delete("/:id", deleteBanner);

export default router;
