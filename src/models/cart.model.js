import mongoose, { Schema } from "mongoose";
import Product from "./product.model.js";

// Define the Cart Item schema
const cartItemSchema = new mongoose.Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
    size: {
        type: String,
        enum: ["S", "M", "L", "XL", "XXL", "XXXL"],
        required: true,
    },
    color: {
        type: Schema.Types.ObjectId,
        ref: "Color",
        required: true,
    },
});

// Define the Cart schema
const cartSchema = new mongoose.Schema(
    {
        items: {
            type: [cartItemSchema],
            default: []
        },
        totalPrice: {
            type: Number,
            default: 0,
        },
        totalItems: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// Pre-save middleware to calculate total price and total items
cartSchema.pre("save", async function (next) {
    // Ensure items is always an array
    if (!this.items) {
        this.items = [];
    }

    this.totalItems = this.items.reduce(
        (total, item) => total + item.quantity,
        0
    );

    this.totalPrice = 0;
    for (const item of this.items) {
        const product = await Product.findById(item.productId);

        if (product) {
            const price = product.isOnSale
                ? product.salePrice.discountedPrice
                : product.nonSalePrice.discountedPrice;

            this.totalPrice += price * item.quantity;
        }
    }

    next();
});

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
