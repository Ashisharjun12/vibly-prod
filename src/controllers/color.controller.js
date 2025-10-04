import mongoose from "mongoose";
import Color from "../models/color.model.js";
import Product from "../models/product.model.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import { withTransaction } from "../utils/withTransaction.js";

/* User Routes */

/**
 * @route   GET /
 * @desc    Get all active colors
 * @access  Public
 */
export const getActiveColors = async (req, res) => {
    try {
        const colors = await Color.find({ isActive: true }).sort({ name: 1 });
        return res.status(200).json({ data: colors });
    } catch (err) {
        return res.status(500).json({ message: "Failed to fetch colors", error: err.message });
    }
};

/**
 * @route   GET /:id
 * @desc    Get color by ID
 * @access  Public
 */
export const getProductsOfColor = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            gender, 
            category, 
            priceGte, 
            priceLte, 
            isOnSale, 
            sort = "newest",
            page = "1",
            limit = "20"
        } = req.query;

        const color = await Color.findById(id);
        if (!color || color.isActive === false)
            return res.status(404).json({ message: "Color not found" });

        const pageNum = Math.max(parseInt(page, 10), 1);
        const perPage = Math.max(parseInt(limit, 10), 1);
        const skipNum = (pageNum - 1) * perPage;

        const matchFilter = { 
            "variants.color": color._id,
            isActive: true 
        };

        // Handle gender filter
        if (gender) {
            const Category = (await import("../models/category.model.js")).default;
            const genderCategories = await Category.find({ gender, isActive: true }).select("_id").lean();
            if (genderCategories.length) {
                matchFilter.category = { $in: genderCategories.map(c => c._id) };
            }
        }

        // Handle category filter
        if (category) {
            const Category = (await import("../models/category.model.js")).default;
            const categoryDoc = await Category.findOne({ name: category, isActive: true }).select("_id").lean();
            if (!categoryDoc) return res.status(404).json({ message: `Category '${category}' not found` });
            matchFilter.category = categoryDoc._id;
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
            {
                $addFields: {
                    variants: {
                        $filter: {
                            input: "$variants",
                            cond: { $eq: ["$$this.color", color._id] }
                        }
                    }
                }
            },
            {
                $match: {
                    "variants.0": { $exists: true } // Only include products that have at least one variant with the selected color
                }
            },
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
    } catch (err) {
        return res.status(500).json({ message: "Fetch failed", error: err.message });
    }
};

/* Admin Routes */

/**
 * @route   GET /admin
 * @desc    Get all colors (admin, with optional isActive filter)
 * @access  Private (Admin)
 */
export const getColorsForAdmin = async (req, res) => {
    try {
        const { isActive } = req.query;
        let filter = {};

        // Only apply isActive filter if explicitly requested
        if (isActive === "true") {
            filter.isActive = true;
        } else if (isActive === "false") {
            filter.isActive = false;
        }
        // If isActive is not provided or is "all", show all colors (no filter)

        const colors = await Color.find(filter).sort({ name: 1 });
        return res.status(200).json({ data: colors });
    } catch (err) {
        return res.status(500).json({ message: "Fetch failed", error: err.message });
    }
};

/**
 * @route   GET /admin/color=:color
 * @desc    Get products of a color (admin)
 * @access  Private (Admin)
 */
export const getProductsOfColorForAdmin = async (req, res) => {
    try {
        const color = await Color.findOne({ name: req.params.color });
        if (!color)
            return res.status(404).json({ message: "Color not found" });

        const products = Product.find({ "varants.color": color._id });

        return res.status(200).json({ data: products, message: "Products fetched successfully" });
    } catch (err) {
        return res.status(500).json({ message: "Fetch failed", error: err.message });
    }
};

/**
 * @route   POST /
 * @desc    Create a new color
 * @access  Private (Admin)
 */
export const createColor = async (req, res) => {
    try {
        const { name, hexCode } = req.body;

        const existingColor = await Color.findOne({ name, hexCode });
        if (existingColor) {
            if (existingColor.name === name) {
                return res.status(400).json({ message: "A color with this name already exists." });
            } else {
                return res.status(400).json({ message: "A color with this hex code already exists." });
            }
        }
        const color = await Color.create({ name, hexCode });
        return res.status(201).json({ data: color });
    } catch (err) {
        return res.status(500).json({ message: "Create failed", error: err.message });
    }
};

/**
 * @route   PUT /:id
 * @desc    Update a color
 * @access  Private (Admin)
 */
export const updateColor = async (req, res) => {
    try {
        const { name, hexCode } = req.body;

        const updatedColor = await Color.findByIdAndUpdate(req.params.id, { name, hexCode }, {
            new: true,
            runValidators: true,
        });

        if (!updatedColor)
            return res.status(404).json({ message: "Color not found" });
        return res.status(200).json({ data: updatedColor });
    } catch (err) {
        console.error("Error in updateColor:", err);
        return res.status(500).json({ message: "Update failed", error: err.message });
    }
};

/**
 * @route   DELETE /:id
 * @desc    Delete a color
 * @access  Private (Admin)
 */
export const deleteColor = async (req, res) => {
    try {
        await withTransaction(async (session) => {
            const { id } = req.params;

            if (!mongoose.isValidObjectId(id)) {
                throw new Error("Invalid color");
            }

            const color = await Color.findById(id).session(session);
            if (!color) {
                throw new Error("Color not found");
            }

            // Step 1: find products using this color
            const products = await Product.find({ "variants.color": color._id }).session(session);

            // We will collect images to delete *after* commit
            const imagesToDelete = [];
            let totalVariantsDeleted = 0;

            for (const product of products) {
                // variants to delete
                const variantsToDelete = product.variants.filter(
                    (variant) => variant.color.toString() === color._id.toString()
                );

                // queue images
                for (const variant of variantsToDelete) {
                    for (const image of variant.images) {
                        if (image.id) {
                            imagesToDelete.push(image.id);
                        }
                    }
                }

                // remove variants from the product
                const originalLength = product.variants.length;
                product.variants = product.variants.filter(
                    (variant) => variant.color.toString() !== color._id.toString()
                );

                if (product.variants.length !== originalLength) {
                    totalVariantsDeleted += originalLength - product.variants.length;
                    await product.save({ session });
                }
            }

            // Step 3: delete the color itself
            await Color.deleteOne({ _id: color._id }).session(session);

            // send success response after DB consistency
            res.status(200).json({
                message: `Color and ${totalVariantsDeleted} variant(s) associated with it deleted successfully.`,
            });

            // AFTER commit, clean up Cloudinary
            for (const imageId of imagesToDelete) {
                try {
                    await deleteFromCloudinary(imageId);
                } catch (cloudErr) {
                    console.error(`Failed to delete Cloudinary image ${imageId}: ${cloudErr.message}`);
                }
            }
        });
    } catch (err) {
        console.error("Error in deleteColor:", err);
        return res.status(500).json({
            message: "Internal Server error",
            error: err.message,
        });
    }
};

/**
 * @route   PUT /:id/toggle
 * @desc    Toggle a color's status
 * @access  Private (Admin)
 */

export const toggleColorStatus = async (req, res) => {
    try {
        await withTransaction(async (session) => {
            const { id } = req.params;

            if (!mongoose.isValidObjectId(id)) {
                throw new Error("Invalid color");
            }

            const color = await Color.findById(id).session(session);
            if (!color) {
                throw new Error("Color not found");
            }

            // Toggle status
            color.isActive = !color.isActive;
            await color.save({ session });

            // update variants of products that reference this color
            const result = await Product.updateMany(
                { "variants.color": color._id },
                { $set: { "variants.$[elem].isActive": color.isActive } },
                {
                    arrayFilters: [{ "elem.color": color._id }],
                    session,
                }
            );

            res.status(200).json({
                message: `Color ${color.isActive ? "activated" : "deactivated"} successfully. ${result.modifiedCount} variant(s) ${color.isActive ? "activated" : "deactivated"}.`,
            });
        });
    } catch (err) {
        console.error("Error in toggleColorStatus:", err);
        return res.status(500).json({
            message: "Toggle failed",
            error: err.message,
        });
    }
};

