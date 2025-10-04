import mongoose from "mongoose";
import fs from "fs";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import Review from "../models/review.model.js";
import Color from "../models/color.model.js";
import { deleteFromCloudinary, uploadToCloudinary } from "../utils/cloudinary.js";
import User from "../models/user.model.js";
import Sale from "../models/sale.model.js";


/* User Routes */

/**
 * @route   GET /products
 * @desc    Get all active products (with filters: gender, category, isOnSale, price, pagination)
 * @access  Public
 */
export const getAllProducts = async (req, res) => {
    try {
        console.log("req.query", req.query)
        const {
            gender,
            category: categoryName,
            color: colorName,
            price = {},
            sort = "newest",
            page = "1",
            limit = "20",
            isOnSale,
            search,
        } = req.query;

        const priceLte = price?.lte;
        const priceGte = price?.gte;


        

        const pageNum = Math.max(parseInt(page, 10), 1);
        const perPage = Math.max(parseInt(limit, 10), 1);
        const skipNum = (pageNum - 1) * perPage;
        
        const matchFilter = { isActive: true };

        // Handle search filter
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i'); // Case-insensitive search
            matchFilter.$or = [
                { name: searchRegex },
                { description: searchRegex }
            ];
        }

        // Handle category filter
        if (categoryName) {
            // Convert slug back to proper case and find category by name (case-insensitive)
            const categoryNameFormatted = categoryName
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            
            const category = await Category.findOne({ 
                name: { $regex: new RegExp(`^${categoryNameFormatted}$`, 'i') }, 
                isActive: true 
            }).select("_id").lean();
            
            if (!category) return res.status(404).json({ message: `Category '${categoryName}' not found` });
            matchFilter.category = category._id;
        }
        
        // Handle gender filter (only if no specific category is selected)
        if (gender) {
            const genderCategories = await Category.find({ gender, isActive: true }).select("_id").lean();
            if (genderCategories.length) {
                matchFilter.category = { $in: genderCategories.map(c => c._id) };
            } else {
                console.log(`No categories found for gender: ${gender}`);
                return res.status(200).json({
                    data: {
                        products: [],
                        pagination: { totalProducts: 0, page: pageNum, limit: perPage, totalPages: 0 }
                    }
                });
            }
        }

        let colorId = null;
        if (colorName) {
            const color = await Color.findOne({ name: colorName, isActive: true }).select("_id").lean();
            if (!color) return res.status(404).json({ message: `Color '${colorName}' not found` });
            colorId = color._id;
        }

        if (isOnSale === "true") matchFilter.isOnSale = true;
        else if (isOnSale === "false") matchFilter.isOnSale = false;

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
                  $toDouble: {
                    $cond: [
                      { $eq: ["$isOnSale", true] },
                      {
                        $ifNull: [
                          "$salePrice.discountedPrice",
                          { $ifNull: ["$salePrice.price", "$nonSalePrice.discountedPrice"] }
                        ]
                      },
                      {
                        $ifNull: [
                          "$nonSalePrice.discountedPrice",
                          "$nonSalePrice.price"
                        ]
                      }
                    ]
                  }
                }
              }
            },
          
            // FACET to compute min/max price BEFORE filtering
            {
              $facet: {
                pricingRange: [
                  {
                    $group: {
                      _id: null,
                      minPrice: { $min: "$unifiedPrice" },
                      maxPrice: { $max: "$unifiedPrice" }
                    }
                  }
                ],
          
                // Actual product pipeline with price filtering, sorting, etc.
                products: [
                  // Conditionally apply price filter
                  ...(priceGte || priceLte ? [{
                    $match: {
                      unifiedPrice: {
                        ...(priceGte ? { $gte: parseFloat(priceGte) } : {}),
                        ...(priceLte ? { $lte: parseFloat(priceLte) } : {})
                      }
                    }
                  }] : []),
          
                  // Filter by color
                  ...(colorId ? [
                    {
                      $addFields: {
                        variants: {
                          $filter: {
                            input: "$variants",
                            as: "variant",
                            cond: { $eq: ["$$variant.color", colorId] }
                          }
                        }
                      }
                    },
                    {
                      $match: {
                        "variants.0": { $exists: true }
                      }
                    }
                  ] : []),
          
                  // Populate category
                  {
                    $lookup: {
                      from: "categories",
                      localField: "category",
                      foreignField: "_id",
                      as: "category"
                    }
                  },
                  { $unwind: "$category" },
          
                  // Populate variant color
                  { $unwind: { path: "$variants", preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: "colors",
                      localField: "variants.color",
                      foreignField: "_id",
                      as: "variants.color"
                    }
                  },
                  { $unwind: { path: "$variants.color", preserveNullAndEmptyArrays: true } },
          
                  // Group back the product
                  {
                    $group: {
                      _id: "$_id",
                      doc: { $first: "$$ROOT" },
                      variants: { $push: "$variants" }
                    }
                  },
                  {
                    $addFields: {
                      "doc.variants": "$variants"
                    }
                  },
                  { $replaceRoot: { newRoot: "$doc" } },
          
                  // Sorting
                  { $sort: sortStage },
          
                  // Pagination
                  { $skip: skipNum },
                  { $limit: perPage },
          
                  // Final projection
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
                      category: { name: "$category.name" },
                      variants: 1,
                      specifications: 1,
                      paymentOptions: 1,
                      averageRating: 1,
                      salesCount: 1,
                      loggedInViews: 1,
                      notLoggedInViews: 1
                    }
                  }
                ],
          
                totalCount: [
                  ...(priceGte || priceLte ? [{
                    $match: {
                      unifiedPrice: {
                        ...(priceGte ? { $gte: parseFloat(priceGte) } : {}),
                        ...(priceLte ? { $lte: parseFloat(priceLte) } : {})
                      }
                    }
                  }] : []),
                  { $count: "count" }
                ]
              }
            }
          ];
          

        const result = await Product.aggregate(pipeline).exec();
        const products = result[0].products;
        const totalProducts = result[0].totalCount[0]?.count || 0;
        const minPrice = result[0].pricingRange[0]?.minPrice || 0;
        const maxPrice = result[0].pricingRange[0]?.maxPrice || 0;
        console.log("result", result[0])


        return res.status(200).json({
            data: {
                products,
                pagination: {
                    totalProducts,
                    page: pageNum,
                    limit: perPage,
                    totalPages: Math.ceil(totalProducts / perPage)
                },
                minPrice,
                maxPrice
            }
        });

    } catch (err) {
        console.error("Error in getAllProducts:", err);
        return res.status(500).json({
            message: "Failed to fetch products",
            error: err.message
        });
    }
};


/**
 * @route   GET /:id
 * @desc    Get single product by ID
 * @access  Public
 */
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate("category variants.color");

        if (!product || product.isActive === false) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Calculate price information
        const priceInfo = {
            isOnSale: product.isOnSale === true,

            currentPrice: product.isOnSale && product.salePrice?.discountedPrice != null
                ? product.salePrice.discountedPrice
                : product.nonSalePrice.discountedPrice,

            originalPrice: product.isOnSale && product.salePrice?.price != null
                ? product.salePrice.price
                : product.nonSalePrice.price,

            discountPercentage: (() => {
                const isSale = product.isOnSale === true;

                const original = isSale
                    ? product.salePrice?.price
                    : product.nonSalePrice?.price;

                const discounted = isSale
                    ? product.salePrice?.discountedPrice
                    : product.nonSalePrice?.discountedPrice;

                return original > 0 && discounted != null
                    ? Math.round(((original - discounted) / original) * 100)
                    : 0;
            })()
        };

        // Increment view counts

        const userId = req.user;
        if (userId) {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: "Invalid user." });
            }
            const productViewed = user.productsViewed.find((productId) => productId.toString() === req.params.id);
            if (!productViewed) {
                product.loggedInViews++;
                user.productsViewed.push(req.params.id);
            }

            await user.save();
        }
        else product.notLoggedInViews++;

        await product.save();
        
        // Get rating distribution
        const reviews = await Review.find({ product: req.params.id });
        const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
            rating,
            count: reviews.filter(r => r.rating === rating).length
        }));
        
        // Return product with enhanced price information and rating distribution
        const productWithPrice = {
            ...product.toObject(),
            priceInfo,
            ratingDistribution
        };
        
        return res.status(200).json({ 
            success: true,
            data: productWithPrice,
            message: "Product retrieved successfully"
        });
    } catch (err) {
        return res.status(500).json({ message: "Fetch failed", error: err.message });
    }
};

/**
 * @route   GET /products/search
 * @desc    Search products with query parameter
 * @access  Public
 */
export const searchProducts = async (req, res) => {
    try {
        const { q: query, limit = "5" } = req.query;

        if (!query || !query.trim()) {
            return res.status(400).json({
                success: false,
                message: "Search query is required",
                data: { products: [] }
            });
        }

        const searchLimit = Math.min(parseInt(limit, 10), 10); // Max 10 results
        const searchRegex = new RegExp(query.trim(), 'i');

        const products = await Product.aggregate([
            {
                $match: {
                    isActive: true,
                    $or: [
                        { name: searchRegex },
                        { description: searchRegex }
                    ]
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $addFields: {
                    unifiedPrice: {
                        $cond: [
                            { $eq: ["$isOnSale", true] },
                            {
                                $ifNull: [
                                    "$salePrice.discountedPrice",
                                    { $ifNull: ["$salePrice.price", "$nonSalePrice.discountedPrice"] }
                                ]
                            },
                            {
                                $ifNull: [
                                    "$nonSalePrice.discountedPrice",
                                    "$nonSalePrice.price"
                                ]
                            }
                        ]
                    },
                    // Get the first image from variants for search results
                    firstImage: {
                        $cond: {
                            if: { $gt: [{ $size: "$variants" }, 0] },
                            then: { $arrayElemAt: ["$variants.orderImage", 0] },
                            else: null
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    unifiedPrice: 1,
                    isOnSale: 1,
                    salePrice: 1,
                    nonSalePrice: 1,
                    category: { name: 1 },
                    images: ["$firstImage"],
                    variants: {
                        $slice: [
                            {
                                $map: {
                                    input: "$variants",
                                    as: "variant",
                                    in: {
                                        orderImage: "$$variant.orderImage"
                                    }
                                }
                            },
                            1
                        ]
                    }
                }
            },
            { $limit: searchLimit }
        ]);

        console.log("products search :", products)
        return res.status(200).json({
            success: true,
            data: { products },
            message: "Search completed successfully"
        });

    } catch (err) {
        console.error("Error in searchProducts:", err);
        return res.status(500).json({
            success: false,
            message: "Search failed",
            data: { products: [] },
            error: err.message
        });
    }
};

/* Admin Routes */

/**
 * @route   POST /
 * @desc    Create new product
 * @access  Private (Admin)
 */

export const createProduct = async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            nonSalePrice,
            salePrice,
            isOnSale,
            specifications,
            variants,
            paymentOptions,
            isActive
        } = req.body;

        if (!name || !description || !category || !nonSalePrice || !variants || !specifications) {
            return res.status(400).json({
                success: false,
                message: "Required fields are missing",
                data: null,
                error: "Missing name, description, category, nonSalePrice, variants, or specifications",
            });
        }

        const parsedNonSalePrice = JSON.parse(nonSalePrice);
        const parsedSalePrice = salePrice ? JSON.parse(salePrice) : { price: 0, discountedPrice: 0 };
        const parsedSpecifications = JSON.parse(specifications);
        const parsedVariants = JSON.parse(variants);
        
        console.log('Parsed variants:', parsedVariants);

        // Validate nonSalePrice
        if (
            isNaN(parsedNonSalePrice.price) ||
            parsedNonSalePrice.price <= 0 ||
            isNaN(parsedNonSalePrice.discountedPrice) ||
            parsedNonSalePrice.discountedPrice < 0 ||
            parsedNonSalePrice.discountedPrice > parsedNonSalePrice.price
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid non-sale price values",
                data: null,
                error: "Price should be > 0, discountedPrice should be <= price",
            });
        }

        // Validate salePrice if isOnSale is true
        const saleEnabled = isOnSale === 'true' || isOnSale === true;
        if (saleEnabled) {
            if (
                isNaN(parsedSalePrice.price) ||
                parsedSalePrice.price <= 0 ||
                isNaN(parsedSalePrice.discountedPrice) ||
                parsedSalePrice.discountedPrice < 0 ||
                parsedSalePrice.discountedPrice > parsedSalePrice.price
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid sale price values",
                    data: null,
                    error: "Sale price should be > 0, discountedPrice should be <= price",
                });
            }
        }

        const categoryDoc = await Category.findOne({ name: category });
        if (!categoryDoc) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
                data: null,
                error: `Category '${category}' does not exist`,
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No image files were uploaded",
                data: null,
                error: "Expected product images",
            });
        }

        console.log("Uploaded Files:", req.files);

        // Group uploaded files by fieldname
        const groupedFiles = req.files.reduce((acc, { fieldname, ...file }) => {
            acc[fieldname] = acc[fieldname] || [];
            acc[fieldname].push(file);
            return acc;
        }, {});
        
        console.log('Files received:', req.files.map(f => ({ fieldname: f.fieldname, path: f.path, size: f.size })));
        console.log('Grouped files:', Object.keys(groupedFiles));

        // Main product images removed - only variant images are used

        // Process each variant
        const processedVariants = await Promise.all(
            parsedVariants.map(async (variant) => {
                const colorDoc = await Color.findOne({ name: variant.color });
                if (!colorDoc) {
                    return res.status(404).json({
                        message: `Color ${variant.color} not found`,
                    });
                }

                // Upload variant images (optional - for gallery)
                const variantImages = groupedFiles[variant.color]
                    ? await Promise.all(
                        groupedFiles[variant.color].map(async (file, index) => {
                            console.log(`Uploading variant image for ${variant.color}:`, file.path);
                            // Don't delete the first file as it might be reused for order image
                            const shouldDelete = index > 0;
                            return await uploadToCloudinary(file.path, "products", shouldDelete);
                        })
                    )
                    : [];

                // Handle orderImage - use first variant image if no separate order image provided
                let uploadedOrderImage;
                const orderImageFile = groupedFiles[`orderImage_${variant.color}`]?.[0];
                
                if (orderImageFile) {
                    // Check if this is the same file as the first variant image
                    const firstVariantFile = groupedFiles[variant.color]?.[0];
                    if (firstVariantFile && orderImageFile.path === firstVariantFile.path) {
                        // Reuse the already uploaded first variant image
                        uploadedOrderImage = variantImages[0];
                        console.log(`Reusing first variant image as order image for ${variant.color}`);
                    } else {
                        // Upload separate order image
                        console.log(`Uploading separate order image for ${variant.color}:`, orderImageFile.path);
                        uploadedOrderImage = await uploadToCloudinary(orderImageFile.path, "products", true);
                    }
                } else if (variantImages.length > 0) {
                    // Use first variant image as order image
                    uploadedOrderImage = variantImages[0];
                    console.log(`Using first variant image as order image for ${variant.color}`);
                } else {
                    return res.status(400).json({
                        success: false,
                        message: `No images provided for color ${variant.color}`,
                        data: null,
                        error: "At least one image is required for each variant",
                    });
                }
                
                if (!uploadedOrderImage) {
                    return res.status(500).json({
                        success: false,
                        message: `Failed to process order image for color ${variant.color}`,
                        data: null,
                        error: "Image processing failed",
                    });
                }

                // Clean up the first variant image file if it was reused
                if (variantImages.length > 0 && (!orderImageFile || orderImageFile.path === groupedFiles[variant.color]?.[0]?.path)) {
                    const firstVariantFile = groupedFiles[variant.color]?.[0];
                    if (firstVariantFile && fs.existsSync(firstVariantFile.path)) {
                        try {
                            fs.unlinkSync(firstVariantFile.path);
                            console.log(`Cleaned up reused file: ${firstVariantFile.path}`);
                        } catch (error) {
                            console.error(`Error cleaning up file: ${error.message}`);
                        }
                    }
                }

                return {
                    color: colorDoc._id,
                    sizes: variant.sizes.map((s) => ({
                        size: s.size,
                        stock: s.stock,
                    })),
                    orderImage: {
                        id: uploadedOrderImage.public_id,
                        secure_url: uploadedOrderImage.secure_url,
                    },
                    images: variantImages.map((img) => ({
                        id: img.public_id,
                        secure_url: img.secure_url,
                    })),
                };
            })
        );

        // Create product
        const product = await Product.create({
            name,
            description,
            category: categoryDoc._id,
            specifications: parsedSpecifications,
            nonSalePrice: {
                price: parsedNonSalePrice.price,
                discountedPrice: parsedNonSalePrice.discountedPrice,
            },
            variants: processedVariants,
            paymentOptions: paymentOptions || { cod: true, online: true },
            isActive,
            isOnSale: saleEnabled,
            salePrice: {
                price: parsedSalePrice.price,
                discountedPrice: parsedSalePrice.discountedPrice,
                discount: 0 // Will be calculated by pre-save hook
            }
        });

        return res.status(201).json({
            message: "Product added successfully",
            data: product,
        });
    } catch (err) {
        console.error("Error in addProduct:", err);
        return res.status(500).json({
            message: "Error adding product",
            error: err.message,
        });
    }
};



/**
 * @route   PATCH /:id
 * @desc    Update a product
 * @access  Private (Admin)
 */

export const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            category,
            specifications,
            paymentOptions,
            nonSalePrice,
            salePrice,
            isOnSale,
            isActive
        } = req.body;

        console.log('Update product request:', { id, body: req.body, files: req.files });

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
                data: null,
                error: `No product found with ID: ${id}`,
            });
        }

        // Basic info
        if (name) product.name = name;
        if (description) product.description = description;

        // Category update
        if (category) {
            const newCategory = await Category.findOne({ name: category });
            if (!newCategory) {
                return res.status(404).json({
                    error: `Category '${category}' does not exist`,
                });
            }
            product.category = newCategory._id;
        }

        // Parse JSON data if it's a string
        let parsedNonSalePrice = nonSalePrice;
        let parsedSalePrice = salePrice;
        let parsedSpecifications = specifications;
        let parsedPaymentOptions = paymentOptions;

        if (typeof nonSalePrice === 'string') {
            try {
                parsedNonSalePrice = JSON.parse(nonSalePrice);
            } catch (e) {
                console.error('Error parsing nonSalePrice:', e);
            }
        }

        if (typeof salePrice === 'string') {
            try {
                parsedSalePrice = JSON.parse(salePrice);
            } catch (e) {
                console.error('Error parsing salePrice:', e);
            }
        }

        if (typeof specifications === 'string') {
            try {
                parsedSpecifications = JSON.parse(specifications);
            } catch (e) {
                console.error('Error parsing specifications:', e);
            }
        }

        if (typeof paymentOptions === 'string') {
            try {
                parsedPaymentOptions = JSON.parse(paymentOptions);
            } catch (e) {
                console.error('Error parsing paymentOptions:', e);
            }
        }

        // Specifications update
        if (parsedSpecifications) {
            product.specifications = parsedSpecifications
        }

        // Non-sale price update
        if (parsedNonSalePrice) {
            if (
                isNaN(parsedNonSalePrice.price) ||
                parsedNonSalePrice.price <= 0 ||
                isNaN(parsedNonSalePrice.discountedPrice) ||
                parsedNonSalePrice.discountedPrice > parsedNonSalePrice.price
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid non-sale price values",
                    data: null,
                    error: "Price must be > 0 and discountedPrice <= price",
                });
            }
            product.nonSalePrice = {
                price: parsedNonSalePrice.price,
                discountedPrice: parsedNonSalePrice.discountedPrice,
            };
        }

        // Sale price update - only validate if sale is enabled and sale price data is provided
        if (parsedSalePrice && (isOnSale === 'true' || isOnSale === true)) {
            if (
                isNaN(parsedSalePrice.price) ||
                parsedSalePrice.price <= 0 ||
                isNaN(parsedSalePrice.discountedPrice) ||
                parsedSalePrice.discountedPrice > parsedSalePrice.price
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid sale price values",
                    data: null,
                    error: "Sale price must be > 0 and discountedPrice <= price",
                });
            }
            product.salePrice = {
                price: parsedSalePrice.price,
                discountedPrice: parsedSalePrice.discountedPrice,
            };
        } else if (isOnSale === 'false' || isOnSale === false) {
            // Reset sale price when sale is disabled
            product.salePrice = {
                price: 0,
                discountedPrice: 0,
            };
        }

        // Payment options update
        if (parsedPaymentOptions) {
            product.paymentOptions = parsedPaymentOptions;
        }

        // Update isOnSale status
        if (isOnSale !== undefined) {
            // Handle string boolean values
            if (typeof isOnSale === 'string') {
                product.isOnSale = isOnSale === 'true';
            } else {
                product.isOnSale = Boolean(isOnSale);
            }
        }

        // Update isActive status
        if (isActive !== undefined) {
            // Handle string boolean values
            if (typeof isActive === 'string') {
                product.isActive = isActive === 'true';
            } else {
                product.isActive = Boolean(isActive);
            }
        }

        await product.save();

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: product,
            error: null,
        });
    } catch (err) {
        console.error("Error in updateProduct:", err);
        return res.status(500).json({
            success: false,
            message: "Error updating product",
            data: null,
            error: err.message,
        });
    }
};


/**
 * @route   DELETE /:id
 * @desc    Delete a product
 * @access  Private (Admin)
 */

export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Collect image IDs from variants
        const imageIds = product.variants.flatMap((variant) =>
            variant.images.map((img) => img.id)
        );

        // Delete images from cloud
        await Promise.all(imageIds.map((imgId) => deleteFromCloudinary(imgId)));

        // Delete associated reviews using direct product reference
        await Review.deleteMany({ product: product._id });

        // If product is on sale, remove the sale entry
        if (product.isOnSale) {
            await Sale.findOneAndDelete({ product: product._id });
        }

        // Delete product
        await product.deleteOne();

        res.status(200).json({
            message: "Product deleted successfully",
        });
    } catch (err) {
        console.error("Delete product error:", err);
        return res.status(500).json({ message: "Delete failed", error: err.message });
    }
};

/**
 * @route   GET /:id
 * @desc    Get a specific product by ID
 * @access  Private (Admin)
 */

export const getProductByIdForAdmin = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate("category variants.color");

        if (!product || product.isActive === false) {
            return res.status(404).json({ message: "Product not found" });
        }

        await product.save();
        return res.status(200).json({ data: product });
    } catch (err) {
        return res.status(500).json({ message: "Fetch failed", error: err.message });
    }
};


/**
 * @route   PATCH /:id/toggle-status
 * @desc    Toggle product status (active/inactive)
 * @access  Private (Admin)
 */
export const toggleProductStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
                data: null,
                error: `No product found with ID: ${id}`
            });
        }

        product.isActive = !product.isActive;
        await product.save();

        return res.status(200).json({
            success: true,
            message: `Product ${product.isActive ? "activated" : "deactivated"} successfully`,
            data: product,
            error: null
        });
    } catch (err) {
        console.error("Error in toggleProductStatus:", err);
        return res.status(500).json({
            success: false,
            message: "Error toggling product status",
            data: null,
            error: err.message
        });
    }
};

/**
 * @route   GET /
 * @desc    Get products for admin with filters
 * @access  Private (Admin)
 */

export const getProductsForAdmin = async (req, res) => {
    try {
        const {
            gender,
            category: categoryName,
            color: colorName,
            "price[lte]": priceLte,
            "price[gte]": priceGte,
            sort = "newest",
            page = "1",
            limit = "20",
            isOnSale,
            isActive = "all",
            search
        } = req.query;

        const pageNum = Math.max(parseInt(page, 10), 1);
        const perPage = Math.max(parseInt(limit, 10), 1);
        const skipNum = (pageNum - 1) * perPage;

        const matchFilter = {};
        
        // Handle search filter
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i'); // Case-insensitive search
            matchFilter.$or = [
                { name: searchRegex },
                { description: searchRegex }
            ];
        }
        
        // Handle isActive filter
        if (isActive === "true") {
            matchFilter.isActive = true;
        } else if (isActive === "false") {
            matchFilter.isActive = false;
        }
        // If isActive is "all", don't add any filter (show all products)

        // Handle category filter
        if (categoryName) {
            // Convert slug back to proper case and find category by name (case-insensitive)
            const categoryNameFormatted = categoryName
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            
            const category = await Category.findOne({ 
                name: { $regex: new RegExp(`^${categoryNameFormatted}$`, 'i') }, 
                isActive: true 
            }).select("_id").lean();
            
            if (!category) return res.status(404).json({ message: `Category '${categoryName}' not found` });
            matchFilter.category = category._id;
        }
        
        // Handle gender filter (only if no specific category is selected)
        if (gender && !categoryName) {
            const genderCategories = await Category.find({ gender, isActive: true }).select("_id").lean();
            if (genderCategories.length) {
                matchFilter.category = { $in: genderCategories.map(c => c._id) };
            } else {
                console.log(`No categories found for gender: ${gender}`);
                return res.status(200).json({
                    data: {
                        products: [],
                        pagination: { totalProducts: 0, page: pageNum, limit: perPage, totalPages: 0 }
                    }
                });
            }
        }

        let colorId = null;
        if (colorName) {
            const color = await Color.findOne({ name: colorName, isActive: true }).select("_id").lean();
            if (!color) return res.status(404).json({ message: `Color '${colorName}' not found` });
            colorId = color._id;
        }

        if (isOnSale === "true") matchFilter.isOnSale = true;
        else if (isOnSale === "false") matchFilter.isOnSale = false;

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

            // Optional: filter variants by color and exclude products without the color
            ...(colorId ? [
                {
                    $addFields: {
                        variants: {
                            $filter: {
                                input: "$variants",
                                as: "variant",
                                cond: { $eq: ["$$variant.color", colorId] }
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

            // Populate category
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },

            // Populate color inside each variant using pipeline (JOIN)
            // Unwind variants first to work with individual variants
            { $unwind: { path: "$variants", preserveNullAndEmptyArrays: true } },
            
            // Lookup color for each variant
            {
                $lookup: {
                    from: "colors",
                    localField: "variants.color",
                    foreignField: "_id",
                    as: "variants.colorInfo"
                }
            },
            
            // Replace the color ObjectId with the populated color object
            {
                $addFields: {
                    "variants.color": { $arrayElemAt: ["$variants.colorInfo", 0] }
                }
            },
            
            // Remove the temporary colorInfo field
            {
                $project: {
                    "variants.colorInfo": 0
                }
            },

            // Group back to full document after processing variants
            {
                $group: {
                    _id: "$_id",
                    doc: { $first: "$$ROOT" },
                    variants: { $push: "$variants" }
                }
            },
            {
                $addFields: {
                    "doc.variants": "$variants"
                }
            },
            {
                $replaceRoot: { newRoot: "$doc" }
            },

            // Sorting
            { $sort: sortStage },

            // Pagination + count
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
                                category: { name: "$category.name" },
                                variants: 1,
                                specifications: 1,
                                paymentOptions: 1,
                                averageRating: 1,
                                salesCount: 1,
                                loggedInViews: 1,
                                notLoggedInViews: 1
                            }
                        }
                    ],
                    totalCount: [
                        { $count: "count" }
                    ]
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
        console.error("Error in getProductsForAdmin:", err);
        return res.status(500).json({
            message: "Failed to fetch products",
            error: err.message
        });
    }
};



/**
 * @route   POST /products/:id/variants
 * @desc    Add a new variant to a product
 * @access  Private (Admin)
 */
export const addVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { color, sizes } = req.body;
        const images = req.files;

        if (!color || !sizes || !images || images.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Color, sizes, and at least one image are required",
                data: null,
                error: "Missing required fields",
            });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
                data: null,
                error: `No product found with ID: ${id}`,
            });
        }

        const colorDoc = await Color.findOne({ name: color });
        if (!colorDoc) {
            return res.status(404).json({
                success: false,
                message: `Color '${color}' not found`,
                data: null,
                error: "Invalid color name",
            });
        }

        // Prevent duplicate color variants
        const existingVariant = product.variants.find(
            (v) => v.color.toString() === colorDoc._id.toString()
        );
        if (existingVariant) {
            return res.status(400).json({
                success: false,
                message: `Variant with color '${color}' already exists`,
                data: null,
                error: "Duplicate variant",
            });
        }

        // Upload images to Cloudinary
        const uploadedImages = await Promise.all(
            images.map((file) => uploadToCloudinary(file.path, "products"))
        );

        // Parse sizes
        let sizeData;
        try {
            sizeData = JSON.parse(sizes);
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: "Invalid sizes format",
                data: null,
                error: "Must be a valid JSON array of sizes",
            });
        }

        const newVariant = {
            color: colorDoc._id,
            sizes: sizeData.map((size) => ({
                size: size.size,
                stock: size.stock,
            })),
            orderImage: {
                id: uploadedImages[0].public_id,
                secure_url: uploadedImages[0].secure_url,
            },
            images: uploadedImages.map((img) => ({
                id: img.public_id,
                secure_url: img.secure_url,
            })),
        };

        product.variants.push(newVariant);
        await product.save();

        return res.status(201).json({
            success: true,
            message: "Variant added successfully",
            data: product,
            error: null,
        });
    } catch (err) {
        console.error("Error in addVariant:", err);
        return res.status(500).json({
            success: false,
            message: "An error occurred while adding the variant",
            data: null,
            error: err.message,
        });
    }
};


/**
 * @route   PATCH "/:id/variants/:colorId"
 * @desc    Update a specific variant of a product
 * @access  Private (Admin)
 */

export const updateVariant = async (req, res) => {
    try {
        const { id, colorId } = req.params;
        const {
            color,
            sizes: sizesJson,
            imagesToDelete,
            newImages: newImagesJson,
            existingImages: existingImagesJson,
        } = req.body;

        const imageFiles = req.files || [];

        if (!id || !colorId) {
            return res.status(400).json({
                success: false,
                message: "Product ID and Color ID are required",
                data: null,
                error: "Missing parameters",
            });
        }

        // Parse input JSON - handle missing fields gracefully
        let sizes, newImages, existingImages, imageIdsToDelete;
        try {
            sizes = typeof sizesJson === "string" ? JSON.parse(sizesJson) : sizesJson;
            newImages = typeof newImagesJson === "string" ? JSON.parse(newImagesJson) : newImagesJson || [];
            existingImages = typeof existingImagesJson === "string" ? JSON.parse(existingImagesJson) : existingImagesJson || [];
            imageIdsToDelete = typeof imagesToDelete === "string" ? JSON.parse(imagesToDelete) : imageIdsToDelete || [];
        } catch (parseError) {
            console.error("JSON parse error:", parseError);
            // If JSON parsing fails, try to handle basic fields
            sizes = typeof sizesJson === "string" ? JSON.parse(sizesJson) : sizesJson;
            newImages = [];
            existingImages = [];
            imageIdsToDelete = [];
        }

        // Fetch product and validate
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
                data: null,
                error: `No product with ID: ${id}`,
            });
        }

        // Check if colorId is a valid ObjectId, otherwise treat as color name
        let currentColorDoc;
        if (mongoose.isValidObjectId(colorId)) {
            // Valid ObjectId format, try to find by ID
            currentColorDoc = await Color.findById(colorId);
        } else {
            // Not a valid ObjectId, treat as color name
            currentColorDoc = await Color.findOne({ name: colorId });
        }
        
        if (!currentColorDoc) {
            return res.status(404).json({
                success: false,
                message: "Current color not found",
                data: null,
                error: "Invalid color ID or name",
            });
        }

        const variantIndex = product.variants.findIndex(
            (v) => v.color.toString() === currentColorDoc._id.toString()
        );
        if (variantIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Variant not found for provided color",
                data: null,
                error: "Variant missing",
            });
        }

        // ✅ Handle color change
        if (color && color !== currentColorDoc.name) {
            const newColorDoc = await Color.findOne({ name: color });
            if (!newColorDoc) {
                return res.status(404).json({
                    success: false,
                    message: `Color '${color}' not found`,
                    data: null,
                    error: "New color does not exist",
                });
            }

            const duplicateVariant = product.variants.find(
                (v) => v.color.toString() === newColorDoc._id.toString()
            );
            if (duplicateVariant) {
                return res.status(400).json({
                    success: false,
                    message: `A variant with color '${color}' already exists`,
                    data: null,
                    error: "Duplicate color variant",
                });
            }

            product.variants[variantIndex].color = newColorDoc._id;
        }

        // ✅ Update sizes
        if (Array.isArray(sizes)) {
            product.variants[variantIndex].sizes = sizes.map((s) => ({
                size: s.size,
                stock: parseInt(s.stock, 10) || 0,
            }));
        }

        // ✅ Image Management
        let updatedImages = [...product.variants[variantIndex].images];

        // Delete images if needed
        if (Array.isArray(imageIdsToDelete) && imageIdsToDelete.length > 0) {
            await Promise.all(
                imageIdsToDelete.map(async (imageId) => {
                    await deleteFromCloudinary(imageId);
                })
            );
            updatedImages = updatedImages.filter(
                (img) => !imageIdsToDelete.includes(img.id)
            );
        }

        // Handle new images if provided via FormData
        if (imageFiles && imageFiles.length > 0) {
            // Upload new images
            const uploadedImageData = await Promise.all(
                imageFiles.map(async (file) => {
                    const uploaded = await uploadToCloudinary(file.path, "products");
                    return {
                        id: uploaded.public_id,
                        secure_url: uploaded.secure_url,
                    };
                })
            );

            // Add new images to existing images (don't replace)
            updatedImages = [...updatedImages, ...uploadedImageData];
        }

        // Update the variant images
        product.variants[variantIndex].images = updatedImages;

        // ✅ Save the final product
        await product.save();

        return res.status(200).json({
            success: true,
            message: "Variant updated successfully",
            data: product.variants[variantIndex],
            error: null,
        });
    } catch (err) {
        console.error("Error in updateVariant:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update variant",
            data: null,
            error: err.message,
        });
    }
};

/**
 * 
 * @route  DELETE /products/:id/variants/:color
 * @desc   Delete a specific variant of a product by color name
 * @access Private (Admin)
 */

export const deleteVariant = async (req, res) => {
    try {
        const { id, color: colorName } = req.params;

        if (!id || !colorName) {
            return res.status(400).json({
                success: false,
                message: "Product ID and color name are required",
                data: null,
                error: "Missing parameters",
            });
        }

        // Find product
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
                data: null,
                error: `No product found with ID: ${id}`,
            });
        }

        // Find color by name
        const colorDoc = await Color.findOne({ name: colorName });
        if (!colorDoc) {
            return res.status(404).json({
                success: false,
                message: `Color '${colorName}' not found`,
                data: null,
                error: "Invalid color name",
            });
        }

        // Find variant
        const variantIndex = product.variants.findIndex(
            (v) => v.color.toString() === colorDoc._id.toString()
        );
        if (variantIndex === -1) {
            return res.status(404).json({
                success: false,
                message: `Variant with color '${colorName}' not found`,
                data: null,
                error: "Variant not found",
            });
        }

        // Clean up images in Cloudinary
        await Promise.all(
            product.variants[variantIndex].images.map(async (img) => {
                await deleteFromCloudinary(img.id);
            })
        );

        // Remove variant
        product.variants.splice(variantIndex, 1);

        await product.save();

        return res.status(200).json({
            success: true,
            message: `Variant with color '${colorName}' deleted successfully`,
            data: null,
            error: null,
        });
    } catch (err) {
        console.error("Error in deleteVariant:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete variant",
            data: null,
            error: err.message,
        });
    }
};

/**
 * @route   GET /products/:id/variants/:color
 * @desc    Get a specific variant of a product by color name
 * @access  Private (Admin)
 */

export const getVariantById = async (req, res) => {
    try {
        const { id, color: colorName, variantId } = req.params;

        const product = await Product.findById(id).populate("variants.color");
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
                data: null,
                error: `No product with ID: ${id}`,
            });
        };

        let variant;
        
        // If variantId is provided (for edit route), find by variant ID
        if (variantId) {
            variant = product.variants.find(
                (v) => v._id.toString() === variantId
            );
        } else {
            // If colorName is provided (for original route), find by color name
            variant = product.variants.find(
                (v) => v.color.name === colorName
            );
        }

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found",
                data: null,
                error: variantId ? `No variant with ID '${variantId}'` : `No variant with color '${colorName}'`,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Variant retrieved successfully",
            data: variant,
            error: null,
        });
    } catch (err) {
        console.error("Error in getVariantById:", err);
        return res.status(500).json({
            success: false,
            message: "An error occurred while fetching the variant",
            data: null,
            error: err.message,
        });
    }
};

/**
 * @route   PUT /products/:id/variants/:color/image
 * @desc    Change variant orderImage for a product
 * @access  Private (Admin)
 */

export const updateVariantOrderImage = async (req, res) => {
    try {
        const { id, color: colorName } = req.params;

        if (!id || !colorName || !req.file) {
            return res.status(400).json({
                success: false,
                message: "Product, color name, and order image are required",
                data: null,
                error: "Missing parameters",
            });
        }

        // Find product
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
                data: null,
                error: `No product found with ID: ${id}`,
            });
        }

        // Find color by name
        const colorDoc = await Color.findOne({ name: colorName });
        if (!colorDoc) {
            return res.status(404).json({
                success: false,
                message: `Color '${colorName}' not found`,
                data: null,
                error: "Invalid color name",
            });
        }

        // Find variant
        const variant = product.variants.find(
            (v) => v.color.toString() === colorDoc._id.toString()
        );
        if (!variant) {
            return res.status(404).json({
                success: false,
                message: `Variant with color '${colorName}' not found`,
                data: null,
                error: "Variant not found",
            });
        }

        const uploadedOrderImage = await uploadToCloudinary(req.file, "order");
        // Update orderImage
        variant.orderImage = uploadedOrderImage;
        
        await deleteFromCloudinary(variant.orderImage.id);

        await product.save();

        return res.status(200).json({
            success: true,
            message: `Variant with color '${colorName}' updated successfully`,
            data: variant,
            error: null,
        });
    } catch (err) {
        console.error("Error in updateVariantOrderImage:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update variant order image",
            data: null,
            error: err.message,
        });
    }
};

/**
 * @route   GET /stats
 * @desc    Get product statistics for admin dashboard
 * @access  Private (Admin)
 */
export const getProductStats = async (req, res) => {
    try {
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(200).json({
                success: true,
                data: {
                    totalProducts: 0,
                    activeProducts: 0,
                    inactiveProducts: 0,
                    recentProducts: 0,
                    categoryStats: [],
                    genderStats: []
                }
            });
        }

        // Get basic counts
        const [
            totalProducts,
            activeProducts,
            inactiveProducts,
            recentProducts
        ] = await Promise.all([
            Product.countDocuments(),
            Product.countDocuments({ isActive: true }),
            Product.countDocuments({ isActive: false }),
            Product.countDocuments({ 
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
            })
        ]);

        // Get category distribution
        let categoryStats = [];
        try {
            categoryStats = await Product.aggregate([
                {
                    $lookup: {
                        from: "categories",
                        localField: "category",
                        foreignField: "_id",
                        as: "categoryInfo"
                    }
                },
                {
                    $unwind: {
                        path: "$categoryInfo",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $group: {
                        _id: { $ifNull: ["$categoryInfo.name", "Unknown"] },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);
        } catch (aggregationError) {
            console.error("Category aggregation error:", aggregationError);
            categoryStats = [];
        }

        // Get gender distribution
        let genderStats = [];
        try {
            genderStats = await Product.aggregate([
                {
                    $lookup: {
                        from: "categories",
                        localField: "category",
                        foreignField: "_id",
                        as: "categoryInfo"
                    }
                },
                {
                    $unwind: {
                        path: "$categoryInfo",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $group: {
                        _id: { $ifNull: ["$categoryInfo.gender", "Unknown"] },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);
        } catch (aggregationError) {
            console.error("Gender aggregation error:", aggregationError);
            genderStats = [];
        }

        return res.status(200).json({
            success: true,
            data: {
                totalProducts,
                activeProducts,
                inactiveProducts,
                recentProducts,
                categoryStats,
                genderStats
            }
        });

    } catch (error) {
        console.error("Error in getProductStats:", error);
        return res.status(200).json({
            success: true,
            data: {
                totalProducts: 0,
                activeProducts: 0,
                inactiveProducts: 0,
                recentProducts: 0,
                categoryStats: [],
                genderStats: []
            }
        });
    }
};
