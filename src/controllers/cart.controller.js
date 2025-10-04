import Color from "../models/color.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import Cart from "../models/cart.model.js";
import { withTransaction } from "../utils/withTransaction.js";

/**
 * @route   POST /cart
 * @desc    Add a product to the user's cart
 * @access  Public
 */

export const addProductinCart = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const userId = req.user;
      const { productId, colorId, quantity, size } = req.body;

      // Basic validations
      if (!productId) {
        return res.status(400).json({ message: "Please select product." });
      }
      if (!colorId) {
        return res.status(400).json({ message: "Please select color." });
      }
      if (!quantity || quantity <= 0) {
        return res
          .status(400)
          .json({ message: "Please select a valid quantity." });
      }
      if (!size) {
        return res.status(400).json({ message: "Please select size." });
      }

      const product = await Product.findOne({
        _id: productId,
        isActive: true,
      }).session(session);
      if (!product) {
        return res.status(404).json({ message: "Product not found." });
      }

      // Check if product has variants
      if (
        !product.variants ||
        !Array.isArray(product.variants) ||
        product.variants.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "Product has no variants available." });
      }

      const color = await Color.findOne({
        _id: colorId,
        isActive: true,
      }).session(session);
      if (!color) {
        return res.status(404).json({ message: "Color not found." });
      }

      const variant = product.variants.find(
        (v) => v.color && v.color.equals(color._id)
      );
      if (!variant) {
        return res.status(404).json({ message: "Selected variant not found." });
      }

      // Check if variant has sizes
      if (
        !variant.sizes ||
        !Array.isArray(variant.sizes) ||
        variant.sizes.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "Selected variant has no sizes available." });
      }

      const sizeOption = variant.sizes.find((s) => s.size === size);
      if (!sizeOption) {
        return res
          .status(404)
          .json({ message: `${size} size is not available.` });
      }

      if (sizeOption.stock < quantity) {
        return res.status(400).json({
          message: `Only ${sizeOption.stock} units available in stock for size ${size}.`,
        });
      }

      const user = await User.findById(userId)
        .populate("cartList")
        .session(session);
      let cart = user?.cartList;

      if (!cart) {
        [cart] = await Cart.create([{ items: [] }], { session });
        user.cartList = cart._id;
        await user.save({ session });
      } else {
        // If cart exists but is populated, we need to get the actual document
        cart = await Cart.findById(cart._id).session(session);
      }

      // Ensure cart.items is initialized
      if (!cart.items) {
        cart.items = [];
      }

      const existingItem = cart.items.find(
        (item) =>
          item.productId.equals(productId) &&
          item.size === size &&
          item.color.equals(color._id)
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ productId, quantity, size, color: color._id });
      }

      await cart.save({ session });

      return res.status(200).json({
        message: "Product successfully added to cart.",
        cart: cart.items,
      });
    });
  } catch (err) {
    console.error("Error adding product to cart:", err);
    return res.status(500).json({
      message: "Failed to add product to cart.",
      error: err.message,
    });
  }
};

/**
 * @route   GET /cart
 * @desc    Get all products in the user's cart
 * @access  Public
 */

export const GetCartProducts = async (req, res) => {
  try {
    const userId = req.user;
    // Fetch user and populate cart with product details and colors
    const user = await User.findById(userId).populate({
      path: "cartList",
      populate: {
        path: "items.productId",
        model: "Product",
        match: { isActive: true },
        populate: {
          path: "variants.color",
          model: "Color",
          match: { isActive: true },
        },
      },
    });

    const rawCart = user?.cartList?.items || [];

    // Filter out invalid product references
    const filteredCart = rawCart.filter((item) => item.productId);

    if (!filteredCart.length) {
      return res.status(200).json({
        success: true,
        message: "No products in cart",
        data: [],
      });
    }

    // Map to only useful data
    const simplifiedCart = filteredCart
      .map((item) => {
        const product = item.productId;

        // Check if product has variants
        if (
          !product.variants ||
          !Array.isArray(product.variants) ||
          product.variants.length === 0
        ) {
          return null; // Skip this item if no variants
        }

        const variant = product.variants.find(
          (v) =>
            v.color &&
            v.color._id &&
            v.color._id.toString() === item.color.toString()
        );

        // Check if variant exists
        if (!variant) {
          return null; // Skip this item if variant not found
        }

        return {
          productId: product._id,
          name: product.name,
          description: product.description,
          price: product.isOnSale
            ? product.salePrice?.discountedPrice
            : product.nonSalePrice?.price || null,
          discountedPrice: product.isOnSale
            ? product.salePrice?.discountedPrice
            : product.nonSalePrice?.discountedPrice || null,
          discount: product.isOnSale
            ? product.salePrice?.discount
            : product.nonSalePrice?.discount || 0,
          paymentOptions: product.paymentOptions,
          selectedVariant: {
            colorId: variant?.color?._id,
            colorName: variant?.color?.name,
            hexCode: variant?.color?.hexCode,
            size: item.size,
            quantity: item.quantity,
          },
          image: {
            id: variant.images?.[0]?.id || "",
            secure_url: variant.images?.[0]?.secure_url || "",
          },
        };
      })
      .filter((item) => item !== null); // Remove null items

    return res.status(200).json({
      success: true,
      message: "Cart products fetched successfully",
      data: simplifiedCart,
    });
  } catch (err) {
    console.error(`Server error: ${err}`);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cart products",
      error: err.message,
    });
  }
};

/**
 * @route   DELETE /cart/:id
 * @desc    Remove an item from the cart by cart item ID
 * @access  Public
 */

export const RemoveFromCart = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const userId = req.user;
      const { productId, colorId, size } = req.body;

      if (!productId || !colorId || !size) {
        return res
          .status(400)
          .json({ message: "Product ID, color ID, and size are required." });
      }

      const user = await User.findById(userId)
        .populate("cartList")
        .session(session);
      if (!user || !user.cartList) {
        return res.status(404).json({ message: "User or cart not found." });
      }

      // Get the actual cart document, not the populated reference
      const cart = await Cart.findById(user.cartList._id).session(session);
      if (!cart) {
        return res.status(404).json({ message: "Cart not found." });
      }

      // Ensure cart.items is initialized
      if (!cart.items) {
        cart.items = [];
      }

      const itemIndex = cart.items.findIndex(
        (item) =>
          item.productId.toString() === productId &&
          item.color.toString() === colorId &&
          item.size === size
      );

      if (itemIndex === -1) {
        return res.status(404).json({ message: "Item not found in cart." });
      }

      cart.items.splice(itemIndex, 1);
      await cart.save({ session });

      return res.status(200).json({
        message: "Item removed from cart successfully.",
        success: true,
        cart: cart.items,
      });
    });
  } catch (err) {
    console.error("Error removing item from cart:", err);
    return res.status(500).json({
      message: "Failed to remove item from cart.",
      error: err.message,
    });
  }
};

/**
 * @route   PATCH /cart/:id
 * @desc    Update quantity of a specific cart item
 * @access  Public
 */

export const UpdateQuantity = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const userId = req.user;
      const { productId, colorId, size, quantity } = req.body;

      if (!productId || !colorId || !size) {
        return res
          .status(400)
          .json({ message: "Product ID, color ID, and size are required." });
      }

      if (!quantity || quantity <= 0) {
        return res.status(400).json({ message: "Invalid quantity." });
      }

      const user = await User.findById(userId)
        .populate({
          path: "cartList",
          populate: {
            path: "items.productId",
            model: "Product",
            match: { isActive: true },
            populate: {
              path: "variants.color",
              model: "Color",
              match: { isActive: true },
            },
          },
        })
        .session(session);

      if (!user || !user.cartList) {
        return res.status(404).json({ message: "Cart not found." });
      }

      // Get the actual cart document with populated products
      const cart = await Cart.findById(user.cartList._id)
        .populate({
          path: 'items.productId',
          populate: {
            path: 'variants.color',
            model: 'Color'
          }
        })
        .session(session);
      if (!cart) {
        return res.status(404).json({ message: "Cart not found." });
      }

      // Ensure cart.items is initialized
      if (!cart.items) {
        cart.items = [];
      }

      const cartItem = cart.items.find(
        (item) =>
          item.productId._id.toString() === productId &&
          item.color.toString() === colorId &&
          item.size === size
      );

      if (!cartItem) {
        return res.status(404).json({ message: "Item not found in cart." });
      }

      // Check stock availability
      const product = cartItem.productId;

      // Check if product has variants
      if (
        !product.variants ||
        !Array.isArray(product.variants) ||
        product.variants.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "Product has no variants available." });
      }

      const variant = product.variants.find(
        (v) => v.color && v.color.equals(cartItem.color)
      );
      if (!variant) {
        return res.status(404).json({ message: "Selected variant not found." });
      }

      // Check if variant has sizes
      if (
        !variant.sizes ||
        !Array.isArray(variant.sizes) ||
        variant.sizes.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "Selected variant has no sizes available." });
      }

      const sizeOption = variant.sizes.find((s) => s.size === cartItem.size);

      if (!sizeOption || sizeOption.stock < quantity) {
        return res.status(400).json({
          message: `Only ${
            sizeOption ? sizeOption.stock : 0
          } items available in stock.`,
        });
      }

      cartItem.quantity = quantity;
      await cart.save({ session });

      return res
        .status(200)
        .json({ message: "Quantity updated successfully." });
    });
  } catch (err) {
    console.error("Failed to update quantity:", err);
    return res.status(500).json({
      message: "Failed to update quantity.",
      error: err.message,
    });
  }
};
