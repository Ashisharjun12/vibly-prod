import mongoose from "mongoose";
import Banner from "../models/banner.model.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import logger from "../utils/logger.js";
import { withTransaction } from "../utils/withTransaction.js";

/* User Routes */

/**
 * @route   GET /
 * @desc    Get banners that should be displayed (only active banners)
 * @access  Public
 */
export const getActiveBanners = async (req, res) => {
    try {
        // Only show banners that are active (isActive: true)
        // Sale status doesn't affect visibility - only active status does
        const banners = await Banner.find({ 
            isActive: true
        }).sort({ order: 1 });
        return res.status(200).json({ data: banners });
    } catch (err) {
        return res.status(500).json({ message: "Failed to fetch banners", error: err.message });
    }
};


/* Admin Routes */

/**
 * @route   POST /upload
 * @desc    Upload a new banner
 * @access  Private (Admin)
 */
export const uploadBanner = async (req, res) => {
    try {
        const file = req.files;
        if (req.files.length > 1)
            return res.status(400).json({ message: "Please upload only one image." });

        if (!file) return res.status(400).json({ message: "Please upload image." });

        const uploaded = await uploadToCloudinary(file[0].path, "banners");
        const currentBannerCount = await Banner.countDocuments({ isActive: true });

        const banner = await Banner.create({
            image: {
                public_id: uploaded.public_id,
                url: uploaded.secure_url,
            },
            order: currentBannerCount + 1,
            isActive: true,
            saleActive: false, // Sale status is managed separately
        });

        logger.info("Banner uploaded successfully");

        return res.status(201).json({ data: banner });
    } catch (err) {
        logger.error("Failed to upload banner", err);
        return res.status(500).json({ message: "Failed to upload banner", error: err.message });
    }
};

/**
 * @route   GET /?isActive=false&saleActive=true
 * @desc    Get banners for admin with filter
 * @access  Private (Admin)
 */
export const getBannersForAdmin = async (req, res) => {
    try {
        const { isActive, saleActive } = req.query;
        let filter = {};
        let sort = { order: 1 };
        
        // Handle isActive filter
        if (isActive === "true") {
            filter.isActive = true;
        } else if (isActive === "false") {
            filter.isActive = false;
            sort = { updatedAt: -1 };
        }
        
        // Handle saleActive filter
        if (saleActive === "true") {
            filter.saleActive = true;
        } else if (saleActive === "false") {
            filter.saleActive = false;
        }

        const banners = await Banner.find(filter).sort(sort);
        return res.status(200).json({ data: banners });
    } catch (err) {
        return res.status(500).json({ message: "Failed to fetch banners", error: err.message });
    }
};

/**
 * @route   PATCH /:id/toggle
 * @desc    Toggle a banner's active status
 * @access  Private (Admin)
 */

export const toggleBannerStatus = async (req, res) => {
    try {
        await withTransaction(async (session) => {
            const id = req.params.id;

            if (!mongoose.isValidObjectId(id)) {
                throw new Error("Invalid banner");
            }

            const banner = await Banner.findById(id).session(session);
            if (!banner) {
                throw new Error("Banner not found");
            }

            const activeCount = await Banner.countDocuments({ isActive: true }).session(session);

            if (banner.isActive) {
                const oldOrder = banner.order;

                await Banner.updateMany(
                    { order: { $gt: oldOrder } },
                    { $inc: { order: -1 } }
                ).session(session);

                banner.isActive = false;
            } else {
                banner.isActive = true;
                banner.order = activeCount + 1;
            }

            await banner.save({ session });

            res.status(200).json({
                message: `Banner has been ${banner.isActive ? "activated" : "hidden"} successfully.`,
            });
        });
    } catch (err) {
        res.status(500).json({
            message: "Failed to toggle status",
            error: err.message,
        });
    }
};

/**
 * @route   PATCH /:id/toggle-sale
 * @desc    Toggle a banner's sale active status
 * @access  Private (Admin)
 */
export const toggleBannerSaleStatus = async (req, res) => {
    try {
        await withTransaction(async (session) => {
            const id = req.params.id;

            if (!mongoose.isValidObjectId(id)) {
                throw new Error("Invalid banner");
            }

            const banner = await Banner.findById(id).session(session);
            if (!banner) {
                throw new Error("Banner not found");
            }

            banner.saleActive = !banner.saleActive;
            await banner.save({ session });

            res.status(200).json({
                message: `Banner sale status has been ${banner.saleActive ? "enabled" : "disabled"} successfully.`,
            });
        });
    } catch (err) {
        res.status(500).json({
            message: "Failed to toggle sale status",
            error: err.message,
        });
    }
};



/**
 * @route   PUT /reorder/all
 * @desc    Reorder all banners
 * @access  Private (Admin)
 */

export const reorderBanners = async (req, res) => {
    try {
        await withTransaction(async (session) => {
            const { orderedIds } = req.body;

            if (!Array.isArray(orderedIds)) {
                throw new Error("Invalid order payload");
            }

            for (let i = 0; i < orderedIds.length; i++) {
                const id = orderedIds[i];
                if (!mongoose.isValidObjectId(id)) {
                    throw new Error(`Invalid banner at position ${i}`);
                }

                const banner = await Banner.findById(id).session(session);
                if (!banner) {
                    throw new Error(`Banner not found at position ${i}`);
                }

                banner.order = i + 1;
                await banner.save({ session });
            }

            res.status(200).json({
                message: "Banners reordered successfully.",
            });
        });
    } catch (err) {
        res.status(500).json({
            message: "Failed to reorder banners",
            error: err.message,
        });
    }
};


/**
 * @route   DELETE /:id
 * @desc    Delete a banner
 * @access  Private (Admin)
 */

export const deleteBanner = async (req, res) => {
    try {
        await withTransaction(async (session) => {
            const id = req.params.id;

            if (!mongoose.isValidObjectId(id)) {
                throw new Error("Invalid banner");
            }

            const banner = await Banner.findById(id).session(session);
            if (!banner) {
                throw new Error("Banner not found");
            }

            const deletedOrder = banner.order;
            const image_public_id = banner.image?.public_id;

            await Banner.deleteOne({ _id: banner._id }).session(session);

            await Banner.updateMany(
                { order: { $gt: deletedOrder } },
                { $inc: { order: -1 } }
            ).session(session);

            res.status(200).json({ message: "Banner deleted successfully." });

            // after commit, do external cleanup
            if (image_public_id) {
                try {
                    await deleteFromCloudinary(image_public_id);
                } catch (cloudErr) {
                    console.error("Cloudinary cleanup failed:", cloudErr.message);
                }
            }
        });
    } catch (err) {
        res.status(500).json({
            message: "Failed to delete banner",
            error: err.message,
        });
    }
};


