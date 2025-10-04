import mongoose from "mongoose";

// Constants
const ALLOWED_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"];

// Size Schema
const sizeSchema = new mongoose.Schema(
    {
        size: {
            type: String,
            enum: ALLOWED_SIZES,
            required: [true, "Size is required"],
        },
        stock: {
            type: Number,
            min: 0,
            default: 0,
        },
    },
    { _id: false }
);

// Variant Schema
const variantSchema = new mongoose.Schema({
    color: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Color",
        required: [true, "Color is required"],
    },
    orderImage: {
        id: {
            type: String,
            required: [true, "Order image ID is required"],
        },
        secure_url: {
            type: String,
            required: [true, "Order image secure URL is required"],
        },
    },
    images: [
        {
            id: {
                type: String,
                required: [true, "Image ID is required"],
            },
            secure_url: {
                type: String,
                required: [true, "Image URL is required"],
            },
        },
    ],
    sizes: [sizeSchema],
});

// Validate unique sizes in a variant
variantSchema.pre("validate", function (next) {
    const sizeSet = new Set(this.sizes.map((s) => s.size));
    if (sizeSet.size !== this.sizes.length) {
        return next(new Error("Duplicate sizes found in variant"));
    }
    next();
});

// Product Schema
const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true,
            maxlength: [100, "Product name cannot exceed 100 characters"],
            index: true,
        },
        description: {
            type: String,
            required: [true, "Product description is required"],
            trim: true,
            maxlength: [2000, "Description cannot exceed 2000 characters"],
        },
        specifications: [
            {
                title: {
                    type: String,
                    required: true,
                    trim: true,
                },
                description: {
                    type: String,
                    required: true,
                    trim: true,
                },
            },
        ],
        nonSalePrice: {
            price: {
                type: Number,
                required: [true, "Price is required"],
                min: 0,
                default: 0,
            },
            discountedPrice: {
                type: Number,
                required: [true, "Discounted price is required"],
                min: 0,
                default: 0,
            },
            discount: { type: Number, min: 0, default: 0 },
        },
        salePrice: {
            price: {
                type: Number,
                min: 0,
            },
            discountedPrice: {
                type: Number,
                min: 0,
            },
            discount: {
                type: Number,
                min: 0,
                default: 0,
            },
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: [true, "Category is required"],
        },
        variants: [variantSchema],
        paymentOptions: {
            cod: { type: Boolean, default: true },
            online: { type: Boolean, default: true },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isOnSale: {
            type: Boolean,
            default: false,
        },
        salesCount: {
            type: Number,
            default: 0,
            min: [0, "Sales count cannot be negative"],
            index: true,
        },
        averageRating: {
            type: Number,
            default: 0,
            min: [0, "Average rating cannot be negative"],
            max: [5, "Average rating cannot exceed 5"],
        },
        totalReviews: {
            type: Number,
            default: 0,
            min: [0, "Total reviews cannot be negative"],
        },
        loggedInViews: { type: Number, default: 0 },
        notLoggedInViews: { type: Number, default: 0 },
    },
    { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual field for total views
productSchema.virtual("totalViews").get(function () {
    return this.loggedInViews + this.notLoggedInViews;
});

// Pre-save hook
productSchema.pre("save", function (next) {
    // Non-sale discount calculation
    if (this.isModified("nonSalePrice")) {
        const { price, discountedPrice } = this.nonSalePrice;
        if (price && discountedPrice) {
            if (discountedPrice > price) {
                return next(new Error("Discounted price cannot be greater than original price"));
            }
            this.nonSalePrice.discount = Math.round(
                ((price - discountedPrice) / price) * 100
            );
        } else {
            this.nonSalePrice.discount = 0;
        }
    }

    // Sale price discount calculation
    if (this.isModified("salePrice")) {
        const { price, discountedPrice } = this.salePrice;
        if (price) {
            if (!discountedPrice) {
                this.salePrice.discountedPrice = price;
            } else if (discountedPrice > price) {
                return next(new Error("Sale discounted price cannot be greater than sale price"));
            }
            this.salePrice.discount = Math.round(
                ((price - this.salePrice.discountedPrice) / price) * 100
            );
        } else {
            this.salePrice.discount = 0;
        }
    }

    // Note: Removed auto-reset of salePrice when isOnSale is false
    // Admin should have full control over sale price data

    next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;
