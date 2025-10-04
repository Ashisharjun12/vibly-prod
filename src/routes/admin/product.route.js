import express from "express";
import {
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductStatus,
    getProductsForAdmin,
    addVariant,
    updateVariant,
    deleteVariant,
    getVariantById,
    getProductByIdForAdmin,
    getProductStats
} from "../../controllers/product.controller.js";
import { upload } from "../../middleware/multer.js";


const router = express.Router();

/**
 * @route   POST /
 * @desc    Create new product
 */
router.post(
    "/",
    upload,
    createProduct
);

/**
 * @route   PATCH /:id
 * @desc    Update product details
 */
router.patch("/:id", upload, updateProduct);

/**
 * @route   GET /:id
 * @desc    Get product details
 */
router.get("/:id", getProductByIdForAdmin);


/**
 * @route   DELETE /:id
 * @desc    Delete a product
 */
router.delete("/:id", deleteProduct);

/**
 * @route   PATCH /:id/toggle-status
 * @desc    Toggle active/inactive status
 */
router.patch("/:id/toggle-status", toggleProductStatus);

/**
 * @route   GET /
 * @desc    Get products with filters (admin view)
 */
router.get("/", getProductsForAdmin);

/**
 * @route   POST /:id/variants
 * @desc    Add a new variant to a product
 */
router.post(
    "/:id/variants",
    upload,
    addVariant
);

/**
 * @route   PATCH /:id/variants:colorId
 * @desc    Update a specific variant
 */
router.patch(
    "/:id/variants/:colorId",
    upload,
    updateVariant
);

/**
 * @route   DELETE /:id/variants&color=:color
 * @desc    Delete a variant from a product
 */
router.delete(
    "/:id/variants&color=:color",
    deleteVariant
);

/**
 * @route   GET /:id/variants/edit/:variantId
 * @desc    Get variant details for editing
 */
router.get(
    "/:id/variants/edit/:variantId",
    getVariantById
);

/**
 * @route   GET /:id/variants&color=:color
 * @desc    Get a specific variant by product and color
 */
router.get(
    "/:id/variants&color=:color",
    getVariantById
);

/**
 * @route   GET /stats
 * @desc    Get product statistics
 */
router.get("/stats", getProductStats);

export default router;
