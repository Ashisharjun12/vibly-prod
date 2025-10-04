import mongoose from "mongoose";
import Category from "../models/category.model.js";
import Product from "../models/product.model.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import logger from "../utils/logger.js";
import { withTransaction } from "../utils/withTransaction.js";

/* User Routes */

/**
 * @route   GET /:id
 * @desc    Get category by ID
 * @access  Public
 */
export const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).find({ isActive: true });
        if (!category) return res.status(404).json({ message: "Not found" });
        return res.status(200).json({ data: category });
    } catch (err) {
        return res.status(500).json({ message: "Fetch failed", error: err.message });
    }
};

/**
 * @route   GET /
 * @desc    Get all active categories
 * @access  Public
 */
export const getActiveCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ createdAt: -1 });
        return res.status(200).json({ data: categories });
    } catch (err) {
        return res.status(500).json({ message: "Fetch failed", error: err.message });
    }
};

/**
 * @route   GET /:id/products
 * @desc    Get products of a specific category
 * @access  Public
 */
export const getProductsOfCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            gender, 
            color, 
            priceGte, 
            priceLte, 
            isOnSale, 
            sort = "newest",
            page = "1",
            limit = "20"
        } = req.query;

        const category = await Category.findById(id).find({ isActive: true });
        if (!category)
            return res.status(404).json({ message: "Category not found" });

        const pageNum = Math.max(parseInt(page, 10), 1);
        const perPage = Math.max(parseInt(limit, 10), 1);
        const skipNum = (pageNum - 1) * perPage;

        const matchFilter = { 
            category: id, 
            isActive: true 
        };

        // Handle gender filter
        if (gender) {
            const genderCategories = await Category.find({ gender, isActive: true }).select("_id").lean();
            if (genderCategories.length) {
                matchFilter.category = { $in: genderCategories.map(c => c._id) };
            }
        }

        // Handle color filter
        let colorId = null;
        if (color) {
            const Color = (await import("../models/color.model.js")).default;
            const colorDoc = await Color.findOne({ name: color, isActive: true }).select("_id").lean();
            if (!colorDoc) return res.status(404).json({ message: `Color '${color}' not found` });
            colorId = colorDoc._id;
        }

        // Handle sale filter
        if (isOnSale === "true") matchFilter.isOnSale = true;
        else if (isOnSale === "false") matchFilter.isOnSale = false;

        // Handle sorting
        let sortStage;
        switch (sort) {
            case "lowToHigh": sortStage = { unifiedPrice: 1 }; break;
            case "highToLow": sortStage = { unifiedPrice: -1 }; break;
            case "topRated": sortStage = { averageRating: -1 }; break;
            case "bestSelling": sortStage = { salesCount: -1 }; break;
            case "alphabetical": sortStage = { name: 1 }; break;
            case "discount": sortStage = { "salePrice.discount": -1 }; break;
            case "newest":
            default: sortStage = { createdAt: -1 }; break;
        }

        const pipeline = [
            { $match: matchFilter },
            {
                $addFields: {
                    unifiedPrice: {
                        $cond: [
                            "$isOnSale",
                            { $ifNull: ["$salePrice.discountedPrice", "$salePrice.price"] },
                            { $ifNull: ["$nonSalePrice.discountedPrice", "$nonSalePrice.price"] }
                        ]
                    }
                }
            },
            ...(priceGte || priceLte ? [{
                $match: {
                    unifiedPrice: {
                        ...(priceGte ? { $gte: parseFloat(priceGte) } : {}),
                        ...(priceLte ? { $lte: parseFloat(priceLte) } : {})
                    }
                }
            }] : []),
            ...(colorId ? [
                {
                    $addFields: {
                        variants: {
                            $filter: {
                                input: "$variants",
                                cond: { $eq: ["$$this.color", colorId] }
                            }
                        }
                    }
                },
                {
                    $match: {
                        "variants.0": { $exists: true } // Only include products that have at least one variant with the selected color
                    }
                }
            ] : []),
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            {
                $lookup: {
                    from: "colors",
                    localField: "variants.color",
                    foreignField: "_id",
                    as: "variants.color"
                }
            },
            {
                $unwind: {
                    path: "$variants.color",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: "$_id",
                    name: { $first: "$name" },
                    description: { $first: "$description" },
                    unifiedPrice: { $first: "$unifiedPrice" },
                    isOnSale: { $first: "$isOnSale" },
                    isActive: { $first: "$isActive" },
                    salePrice: { $first: "$salePrice" },
                    nonSalePrice: { $first: "$nonSalePrice" },
                    createdAt: { $first: "$createdAt" },
                    updatedAt: { $first: "$updatedAt" },
                    category: { $first: "$category" },
                    categoryInfo: { $first: "$categoryInfo" },
                    variants: { $push: "$variants" }
                }
            },
            { $sort: sortStage },
            {
                $facet: {
                    products: [
                        { $skip: skipNum },
                        { $limit: perPage },
                        {
                            $project: {
                                name: 1,
                                description: 1,
                                unifiedPrice: 1,
                                isOnSale: 1,
                                isActive: 1,
                                salePrice: 1,
                                nonSalePrice: 1,
                                createdAt: 1,
                                updatedAt: 1,
                                category: 1,
                                categoryInfo: 1,
                                variants: 1
                            }
                        }
                    ],
                    totalCount: [{ $count: "count" }]
                }
            }
        ];

        const result = await Product.aggregate(pipeline).exec();
        const products = result[0].products;
        const totalProducts = result[0].totalCount[0]?.count || 0;

        return res.status(200).json({ 
            data: {
                products,
                pagination: {
                    totalProducts,
                    page: pageNum,
                    limit: perPage,
                    totalPages: Math.ceil(totalProducts / perPage)
                }
            }
        });
    } catch (error) {
        console.error(`Server error: ${error}`);
        return res.status(500).json({ message: "Failed to get products of category", error: error.message });
    }
};


/* Admin Routes */

/**
 * @route   POST /
 * @desc    Create new category
 * @access  Private (Admin)
 */
export const createCategory = async (req, res) => {
    try {
        const { name, gender } = req.body;

        const existingCategory = await Category.findOne({ name, gender });
        if (existingCategory)
            return res.status(400).json({ message: "Category already exists" });

        const category = await Category.create({ name, gender });
        return res.status(201).json({ data: category });
    } catch (err) {
        return res.status(500).json({ message: "Create failed", error: err.message });
    }
};

/**
 * @route   GET /
 * @desc    Get all categories
 * @access  Private (Admin)
 */
export const getCategoriesForAdmin = async (req, res) => {
    try {
        const { gender, isActive } = req.query;
        let filter = {};

        // Only apply gender filter if provided
        if (gender) {
            filter.gender = gender.toLowerCase();
        }

        // Only apply isActive filter if explicitly requested
        if (isActive === "true") {
            filter.isActive = true;
        } else if (isActive === "false") {
            filter.isActive = false;
        }
        // If isActive is not provided or is "all", show all categories (no filter)

        const categories = await Category.find(filter).sort({ createdAt: -1 });
        return res.status(200).json({ data: categories });
    } catch (err) {
        return res.status(500).json({ message: "Fetching Categories failed", error: err.message });
    }
};

/**
 * @route   PATCH /:id
 * @desc    Update category by ID
 * @access  Private (Admin)
 */
export const updateCategory = async (req, res) => {
    try {
        const { name, gender } = req.body;

        const updatedCategory = await Category.findByIdAndUpdate(req.params.id, { name, gender }, {
            new: true,
            runValidators: true,
        });
        if (!updatedCategory) return res.status(404).json({ message: "Not found" });
        return res.status(200).json({ data: updatedCategory });
    } catch (err) {
        return res.status(500).json({ message: "Update failed", error: err.message });
    }
};

/**
 * @route   DELETE /:id
 * @desc    Delete category
 * @access  Private (Admin)
 */

export const deleteCategory = async (req, res) => {
    try {
        await withTransaction(async (session) => {
            const id = req.params.id;

            if (!mongoose.isValidObjectId(id)) {
                throw new Error("Invalid category");
            }

            const category = await Category.findById(id).session(session);
            if (!category) {
                throw new Error("Category not found");
            }

            // Find associated products
            const products = await Product.find({ category: id }).session(session);

            // Delete products within transaction
            for (const product of products) {
                await Product.deleteOne({ _id: product._id }).session(session);
            }

            // Delete the category
            await Category.deleteOne({ _id: id }).session(session);

            // respond to client after DB is safe
            res.status(200).json({
                message: "Category and associated products deleted successfully.",
            });

            // after commit, clean up Cloudinary (non-blocking)
            setTimeout(async () => {
                try {
                    for (const product of products) {
                        if (product.variants && Array.isArray(product.variants)) {
                            for (const variant of product.variants) {
                                if (variant.images && Array.isArray(variant.images)) {
                                    for (const image of variant.images) {
                                        if (image.id) {
                                            try {
                                                await deleteFromCloudinary(image.id);
                                            } catch (cloudErr) {
                                                console.error(
                                                    `Failed to delete Cloudinary image ${image.id}: ${cloudErr.message}`
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error in Cloudinary cleanup:', error);
                }
            }, 1000); // Run cleanup after 1 second
        });
    } catch (err) {
        console.error('Error in deleteCategory:', err);
        res.status(500).json({
            message: "Delete failed",
            error: err.message,
        });
    }
};


/**
 * @route   PUT /:id/toggle
 * @desc    Toggle category status
 * @access  Private (Admin)
 */

export const toggleCategoryStatus = async (req, res) => {
    try {
        await withTransaction(async (session) => {
            const id = req.params.id;

            console.log('Toggle category status request:', { id });

            if (!mongoose.isValidObjectId(id)) {
                throw new Error("Invalid category ID");
            }

            const category = await Category.findById(id).session(session);
            if (!category) {
                throw new Error("Category not found");
            }

            console.log('Category found:', { 
                id: category._id, 
                name: category.name, 
                isActive: category.isActive 
            });

            category.isActive = !category.isActive;
            await category.save({ session });

            console.log('Category status toggled:', { 
                id: category._id, 
                newStatus: category.isActive 
            });

            // If deactivating category, also deactivate related products
            if (!category.isActive) {
                try {
                    const productUpdateResult = await Product.updateMany(
                        { category: category._id },
                        { $set: { isActive: false } }
                    ).session(session);
                    console.log('Products deactivated:', productUpdateResult.modifiedCount);
                } catch (productError) {
                    console.error('Error updating products:', productError);
                    // Don't fail the entire operation if product update fails
                }
            }

            res.status(200).json({
                message: `Category ${category.isActive ? "activated" : "deactivated"}${category.isActive ? "" : " and related products archived"}`,
                data: {
                    id: category._id,
                    name: category.name,
                    isActive: category.isActive
                }
            });
        });
    } catch (err) {
        console.error('Error in toggleCategoryStatus:', err);
        res.status(500).json({ 
            message: "Toggle failed", 
            error: err.message 
        });
    }
};