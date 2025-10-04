import express from "express";
import {
    addProductinCart,
    GetCartProducts,
    RemoveFromCart,
    UpdateQuantity
} from "../../controllers/cart.controller.js";

const router = express.Router();

/**
 * @route   POST /cart
 * @desc    Add a product to the cart
 * @access  Public
 */
router.post("/", addProductinCart);

/**
 * @route   GET /cart
 * @desc    Get all products in the cart
 * @access  Public
 */
router.get("/", GetCartProducts);

/**
 * @route   DELETE /cart/remove-item
 * @desc    Remove a product from the cart by productId, colorId, and size
 * @access  Public
 */
router.delete("/remove-item", RemoveFromCart);

/**
 * @route   PATCH /cart/update-quantity
 * @desc    Update quantity of a product in the cart
 * @access  Public
 */
router.patch("/update-quantity", UpdateQuantity);

export default router;
