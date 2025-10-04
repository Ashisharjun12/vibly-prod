import { Order, OrderStatus, PaymentMethod } from '../models/order.model.js';
import Joi from 'joi';
import { withTransaction } from '../utils/withTransaction.js';
import { generateCancelId, generateItemId, generateOrderId, generateReturnId } from '../utils/helper.js';
import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import Color from '../models/color.model.js';

const canTransition = (current, target) => {
    return OrderStatus[current]?.next.includes(target);
};

// Validation Schemas
const orderItemSchema = Joi.object({
    productId: Joi.string().required(),
    colorId: Joi.string().required(),
    size: Joi.string().valid('XS', 'S', 'M', 'L', 'XL', 'XXL').required(),
    quantity: Joi.number().integer().min(1).required(),
    price: Joi.number().precision(2).min(0).required(),
    shippingCharges: Joi.number().precision(2).min(0).default(0),
    discount: Joi.number().precision(2).min(0).default(0)
});

const createOrderSchema = Joi.object({
    items: Joi.array().items(orderItemSchema).min(1).required(),
    shippingInfo: Joi.object({
        address: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        country: Joi.string().required(),
        postalCode: Joi.string().required(),
        phone: Joi.string().required(),
    }).required(),
    paymentMethod: Joi.string().valid(...Object.values(PaymentMethod)).required(),
});

// Controller: Create Order
export const createOrder = async (req, res) => {
    console.log('createOrder called');

    const { error, value } = createOrderSchema.validate(req.body, { abortEarly: false });
    if (error) {
        console.log('Validation error');
        return res.status(400).json({ success: false, message: 'Please order properly.' });
    }

    const { items, shippingInfo, paymentMethod } = value;
    const userId = req.user;

    console.log('userId:', userId);

    if (!userId) {
        console.log('User not authenticated');
        return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Fetch user and cart
    const userDoc = await User.findById(userId).populate({
        path: "cartList",
        populate: { path: "items.productId items.color" },
    });

    console.log('userDoc:', userDoc);

    if (!userDoc?.cartList) {
        console.log('Cart not found');
        return res.status(400).json({ success: false, message: "Cart not found" });
    }

    const cartItems = userDoc.cartList.items;

    // Validate cart contents
    for (const item of items) {
        console.log('Validating item:', item);

        const matchedCartItem = cartItems.find(cartItem =>
            cartItem.productId._id.toString() === item.productId &&
            cartItem.color._id.toString() === item.colorId &&
            cartItem.size === item.size
        );

        if (!matchedCartItem) {
            let product = await Product.findById(item.productId).populate('variants.color');
            if (!product) {
                console.log('Product not found in cart');
                return res.status(400).json({
                    success: false,
                    message: `Product not found in your cart.`,
                });
            }

            let variant = product.variants.find(v => v.color._id.toString() === item.colorId);

            if (!variant) {
                console.log('Color not found in cart');
                return res.status(400).json({
                    success: false,
                    message: `Color ${item.colorId} not found in your cart.`,
                });
            }

            console.log('Item not found in cart');
            return res.status(400).json({
                success: false,
                message: `Item ${product.name} with color ${variant.color.name} and size ${item.size} not found in your cart.`,
            });
        }
    }

    // Generate orderId
    let orderId;
    do {
        orderId = generateOrderId();
    } while (await Order.exists({ orderId }));

    try {
        console.log('withTransaction started');

        await withTransaction(async (session) => {
            const createdOrders = [];

            for (const item of items) {
                console.log('Creating order item for:', item);

                const {
                    productId,
                    colorId,
                    size,
                    quantity,
                    price,
                    shippingCharges = 0
                } = item;

                const color = await Color.findOne({ _id: colorId, isActive: true }).session(session);
                if (!color) {
                    throw new Error(`Color not found`);
                }

                const product = await Product.findOne({ _id: productId, isActive: true }).session(session);
                if (!product) {
                    throw new Error(`Product not found`);
                }

                const variant = product.variants.find(v =>
                    v.color.toString() === colorId &&
                    v.sizes.some(s => s.size === size)
                );

                console.log('variant:', variant);

                if (!variant) {
                    throw new Error(`Variant not found for product ${product.name}`);
                }

                const sizeStock = variant.sizes.find(s => s.size === size);
                if (sizeStock.stock < quantity) {
                    throw new Error(`Insufficient stock for ${product.name} - size ${size} and color ${variant.color.name}`);
                }

                // Decrement stock
                sizeStock.stock -= quantity;
                await product.save({ session });

                // Create individual order items per quantity
                for (let i = 0; i < quantity; i++) {
                    let itemId;
                    do {
                        itemId = generateItemId();
                    } while (await Order.exists({ itemId }));

                    const newOrder = new Order({
                        user: userId,
                        orderId,
                        itemId,
                        product: {
                            name: product.name,
                            image: {
                                id: variant.orderImage.id,
                                secure_url: variant.orderImage.secure_url,
                            },
                            productId: product._id,
                        },
                        color: {
                            name: color.name,
                            hexCode: color.hexCode,
                        },
                        size,
                        amount: {
                            price,
                            shippingCharges,
                            totalAmount: price + shippingCharges,
                        },
                        shippingInfo,
                        paymentMethod
                    });

                    createdOrders.push(newOrder.save({ session }));
                }
            }

            await Promise.all(createdOrders);

            // 🧹 REMOVE ordered items from the cart
            userDoc.cartList.items = cartItems.filter(cartItem =>
                !items.some(orderItem =>
                    cartItem.productId._id.toString() === orderItem.productId &&
                    cartItem.color._id.toString() === orderItem.colorId &&
                    cartItem.size === orderItem.size
                )
            );

            await userDoc.cartList.save({ session });

            console.log('Order placed successfully');

            return res.status(201).json({ success: true, message: "Order placed successfully", orderId });
        });

    } catch (err) {
        console.log('Server error:', err.message);
        return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
};

// Controller: Get User Orders
export const getUserOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user }).sort({ createdAt: -1 });

        // Step 1: Group by orderId
        const groupedByOrderId = orders.reduce((acc, curr) => {
            const orderId = curr.orderId;
            if (!acc[orderId]) acc[orderId] = [];
            acc[orderId].push(curr);
            return acc;
        }, {});

        // Step 2: Transform each order group
        const transformedOrders = Object.entries(groupedByOrderId).map(([orderId, items]) => {
            const productsMap = {};

            for (const item of items) {
                const productId = item.product.productId.toString();
                const statusKey = item.orderStatus;

                if (!productsMap[productId]) {
                    productsMap[productId] = {
                        productId,
                        name: item.product.name,
                        image: item.product.image,
                        color: item.color,
                        size: item.size,
                        amount: item.amount,
                        quantity: 0,
                        createdAt: item.createdAt,
                        itemsGroupedByStatus: {}, // NEW: grouping here
                    };
                }

                // Initialize status group if needed
                if (!productsMap[productId].itemsGroupedByStatus[statusKey]) {
                    productsMap[productId].itemsGroupedByStatus[statusKey] = [];
                }

                // Add item to its status group
                productsMap[productId].itemsGroupedByStatus[statusKey].push({
                    _id: item._id,
                    itemId: item.itemId,
                    orderStatus: item.orderStatus,
                    shippedAt: item.shippedAt,
                    deliveredAt: item.deliveredAt,
                    cancelledAt: item.cancelledAt,
                    cancelId: item.cancelId,
                    returnRequestedAt: item.returnRequestedAt,
                    returnId: item.returnId,
                    returnedAt: item.returnedAt,
                    refundAmount: item.refundAmount,
                    refundProcessedAt: item.refundProcessedAt,
                    refundStatus: item.refundStatus,
                    returnRequestNote: item.returnRequestNote,
                    statusHistory: item.statusHistory,
                    size: item.size,
                });

                productsMap[productId].quantity += 1;
            }

            const products = Object.values(productsMap);

            return {
                orderId,
                products,
                orderedAt: items[0]?.orderedAt,
                shippingInfo: items[0]?.shippingInfo,
                paymentMethod: items[0]?.paymentMethod,
                paymentStatus: items[0]?.paymentStatus,
            };
        });

        return res.status(200).json({ success: true, data: transformedOrders });
    } catch (err) {
        console.error('getUserOrders error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


// Controller: Get Orders by OrderId
export const getOrderByOrderId = async (req, res) => {
    try {
        const { orderId } = req.params;

        const orders = await Order.find({ orderId, user: req.user });
        if (!orders.length) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Group by productId
        const productsMap = {};

        for (const item of orders) {
            const productId = item.product.productId.toString();

            if (!productsMap[productId]) {
                productsMap[productId] = {
                    productId,
                    name: item.product.name,
                    image: item.product.image,
                    color: item.color,
                    size: item.size,
                    amount: item.amount,
                    quantity: 0,
                    items: [],
                    createdAt: item.createdAt,
                };
            }

            productsMap[productId].quantity += 1;
            productsMap[productId].items.push({
                _id: item._id,
                itemId: item.itemId,
                orderStatus: item.orderStatus,
                shippedAt: item.shippedAt,
                deliveredAt: item.deliveredAt,
                cancelledAt: item.cancelledAt,
                returnRequestedAt: item.returnRequestedAt,
                returnedAt: item.returnedAt,
                refundProcessedAt: item.refundProcessedAt,
            });
        }

        const products = Object.values(productsMap);

        // Determine overall status
        const statuses = orders.map(i => i.orderStatus);
        let status = 'Ordered';
        if (statuses.every(s => s === 'Delivered')) status = 'Delivered';
        else if (statuses.every(s => s === 'Cancelled')) status = 'Cancelled';
        else if (statuses.every(s => s === 'Returned')) status = 'Returned';
        else if (statuses.includes('Return Requested')) status = 'Return Requested';
        else if (statuses.includes('Shipped')) status = 'Shipped';

        const transformedOrder = {
            orderId,
            status,
            products,
            orderedAt: orders[0].orderedAt,
            shippingInfo: orders[0].shippingInfo,
            paymentMethod: orders[0].paymentMethod,
            paymentStatus: orders[0].paymentStatus,
        };

        return res.status(200).json({ success: true, data: transformedOrder });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


// Controller: Cancel Order Item
export const cancelOrderItem = async (req, res) => {
    try {
        await withTransaction(async (session) => {
            const { itemIds } = req.body;

            if (!Array.isArray(itemIds) || itemIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'ItemIds must be a non-empty array',
                });
            }

            const cancelledItems = [];

            for (const itemId of itemIds) {
                const order = await Order.findOne({ itemId, user: req.user }).session(session);

                if (!order) {
                    return res.status(404).json({
                        success: false,
                        message: `Item not found`,
                    });
                }

                if (!canTransition(order.orderStatus, 'Cancelled')) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot cancel item with status: ${order.orderStatus}`,
                    });
                }

                // Generate unique cancelId
                let cancelId;
                do {
                    cancelId = generateCancelId();
                } while (await Order.exists({ cancelId }).session(session));

                order.cancelId = cancelId;
                order.cancelledAt = new Date();

                await order.updateStatus('CANCELLED', 'Cancelled by user'); // Make sure this method uses session internally if needed

                await order.save({ session });
                cancelledItems.push(order);
            }

            return res.status(200).json({
                success: true,
                message: 'Selected items cancelled successfully',
                data: cancelledItems,
            });
        });
    } catch (err) {
        console.error('Cancel Order Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message,
        });
    }
};


// Controller: Return Order Item
export const returnOrderItem = async (req, res) => {
    try {
        const { itemIds, note } = req.body;

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ success: false, message: 'itemIds must be a non-empty array' });
        }

        if (!note || typeof note !== 'string') {
            return res.status(400).json({ success: false, message: 'Return note is required' });
        }

        const returnedItems = [];

        for (const itemId of itemIds) {
            const order = await Order.findOne({ itemId, user: req.user });

            if (!order) {
                return res.status(404).json({ success: false, message: `Item not found` });
            }

            console.log("Order status : ", order.orderStatus);

            if (!canTransition(order.orderStatus, 'Return Requested')) {
                return res.status(400).json({ success: false, message: "Cannot return item." });
            }


            // Check if delivery timestamp exists
            const deliveredEntry = order.statusHistory.find(s => s.status === 'DELIVERED');
            if (!deliveredEntry || !deliveredEntry.timestamp) {
                return res.status(400).json({ success: false, message: "Delivery timestamp missing" });
            }

            // Check 7-day return window
            const deliveredAt = new Date(deliveredEntry.timestamp);
            const daysPassed = Math.floor((Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24));

            if (daysPassed > 7) {
                return res.status(400).json({
                    success: false,
                    message: `Return window expired. ${daysPassed} days have passed since delivery.`,
                });
            }

            // Generate unique returnId
            let returnId;
            do {
                returnId = generateReturnId();
            } while (await Order.exists({ returnId }));

            order.returnId = returnId;
            order.returnRequestedAt = new Date();
            order.returnRequestNote = note;
            await order.updateStatus('RETURN_REQUESTED', note);

            await order.save();
            returnedItems.push(order);
        }

        return res.status(200).json({
            success: true,
            message: 'Return requested successfully for selected items',
            data: returnedItems,
        });

    } catch (err) {
        console.error('Return Order Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message,
        });
    }
};


// Controller: Cancel Return Request (User)
export const cancelReturnRequest = async (req, res) => {
    try {
        const { itemIds } = req.body;

        if (!Array.isArray(itemIds) || itemIds.length === 0) {
            return res.status(400).json({ success: false, message: 'itemIds must be a non-empty array' });
        }

        const cancelledItems = [];

        for (const itemId of itemIds) {
            const order = await Order.findOne({ itemId, user: req.user });

            if (!canTransition(order.orderStatus, 'Return Cancelled')) {
                return res.status(400).json({ success: false, message: "Cannot cancel item." });
            }

            order.returnCancelledAt = new Date();
            order.updateStatus("RETURN_CANCELLED", 'Return request cancelled by user');

            await order.save();
            cancelledItems.push(order);
        }

        return res.status(200).json({
            success: true,
            message: 'Return request(s) cancelled successfully',
        });

    } catch (err) {
        console.error('Cancel Return Request Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message,
        });
    }
};


// GET /admin/orders
export const getAllOrders = async (req, res) => {
    try {
        let { page = 1, limit = 20, status, paymentStatus } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);

        const filter = {};

        // Status filtering for Option 2 model (status is inside items array)
        if (status) {
            filter['items.orderStatus'] = status;
        }

        // Payment status filtering
        if (paymentStatus) {
            filter.paymentStatus = paymentStatus;
        }

        const orders = await Order.find(filter)
            .populate('user', 'name email') // admin probably needs user info
            .populate('items.product.productId', 'name image') // optional, for product detail
            .sort({ orderedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const totalDocs = await Order.countDocuments(filter);

        return res.status(200).json({
            success: true,
            page,
            limit,
            totalDocs,
            totalPages: Math.ceil(totalDocs / limit),
            data: orders
        });

    } catch (err) {
        console.error('getAllOrders error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
};


// GET /admin/orders/:orderId/items
// Controller: Get single order by orderId (same structure as getUserOrders)
export const getOrderItemsByOrderId = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Find all items in this order for this user, earliest items first
        const items = await Order.find({ orderId, user: req.user }).sort({ createdAt: 1 });

        if (!items.length) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
   // find user by orderId
   const user = await User.findOne({ orderId });

        // Step 1: Group products inside this order
        const productsMap = {};

        for (const item of items) {
            const productId = item.product.productId.toString();
            const statusKey = item.orderStatus;

            if (!productsMap[productId]) {
                productsMap[productId] = {
                    productId,
                    name: item.product.name,
                    image: item.product.image,
                    color: item.color,
                    size: item.size,
                    amount: item.amount,
                    quantity: 0,
                    createdAt: item.createdAt,
                    itemsGroupedByStatus: {},
                };
            }

            // Initialize status group if missing
            if (!productsMap[productId].itemsGroupedByStatus[statusKey]) {
                productsMap[productId].itemsGroupedByStatus[statusKey] = [];
            }

            // Add this item under its status group
            productsMap[productId].itemsGroupedByStatus[statusKey].push({
                _id: item._id,
                itemId: item.itemId,
                orderStatus: item.orderStatus,
                shippedAt: item.shippedAt,
                deliveredAt: item.deliveredAt,
                cancelledAt: item.cancelledAt,
                cancelId: item.cancelId,
                returnRequestedAt: item.returnRequestedAt,
                returnId: item.returnId,
                returnedAt: item.returnedAt,
                refundAmount: item.refundAmount,
                refundProcessedAt: item.refundProcessedAt,
                refundStatus: item.refundStatus,
                returnRequestNote: item.returnRequestNote,
                statusHistory: item.statusHistory,
                size: item.size,
            });

            productsMap[productId].quantity += 1;
        }

        const products = Object.values(productsMap);


        // Step 3: Build response
        const transformedOrder = {
            user,
            orderId,
            products,
            orderedAt: items[0]?.orderedAt,
            shippingInfo: items[0]?.shippingInfo,
            paymentMethod: items[0]?.paymentMethod,
            paymentStatus: items[0]?.paymentStatus,
        };

        return res.status(200).json({ success: true, data: transformedOrder });

    } catch (err) {
        console.error('getOrderByOrderId error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


// PUT /admin/items/:itemId/status
export const updateOrderItemStatus = async (req, res) => {
    const { itemId } = req.params;
    const { newStatus, note = "" } = req.body;

    try {
        const order = await Order.findOne({ itemId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // Validate transition
        if (!canTransition(order.orderStatus, newStatus)) {
            return res.status(400).json({ success: false, message: 'Cannot update status of this item' });
        }

        // Get the enum key from the value
        let newStatusKey;
        for (const key in OrderStatus) {
            if (OrderStatus[key].value === newStatus) {
                newStatusKey = key;
                break;
            }
        }

        // Update status using method that includes .save()
        await order.updateStatus(newStatusKey, note);

        // Handle additional fields (if needed for RETURNED or CANCELLED)
        if (newStatusKey === 'RETURNED') {
            order.refundStatus = "Pending";
        }

        if (newStatusKey === 'CANCELLED') {
            let cancelId;
            do {
                cancelId = generateCancelId();
            } while (await Order.exists({ cancelId }));
            order.cancelId = cancelId;
        }

        // Save again at RETURNED or CANCELLED
        if (newStatusKey === 'RETURNED' || newStatusKey === 'CANCELLED') {
            await order.save();
        }

        return res.json({ success: true, message: 'Status updated successfully', data: order });
    } catch (err) {
        console.error('Status update error:', err);
        return res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};


// POST /admin/items/:itemId/return-cancel
export const processReturnCancel = async (req, res) => {
    try {
        const { itemId } = req.params;

        const order = await Order.findOne({ itemId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (canTransition(order.orderStatus, 'RETURN_CANCELLED')) {
            return res.status(400).json({ success: false, message: 'It is not possible to cancel the return request at this stage.' });
        }

        order.returnCancelledAt = new Date();
        order.updateStatus(OrderStatus.RETURN_CANCELLED, 'Return request cancelled by Vibly');
        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Return request cancelled successfully',
            data: order,
        });
    } catch (err) {
        console.error('processReturnCancel error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while cancelling return request',
            error: err.message,
        });
    }
};

// POST /admin/items/:itemId/refund
export const processRefund = async (req, res) => {

    const { refundAmount } = req.body;

    try {
        const { itemId } = req.params;

        const order = await Order.findOne({ itemId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // Validation: Refund can only be processed if return was requested and completed

        if (!canTransition(order.orderStatus, 'Refunded')) {
            return res.status(400).json({ success: false, message: 'Refund already processed' });
        }

        // Update refund details
        order.refundAmount = refundAmount;
        order.refundStatus = "Refunded";
        order.updateStatus(OrderStatus.REFUNDED);

        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Refund processed successfully',
            data: order,
        });
    } catch (err) {
        console.error('Refund processing error:', err);
        return res.status(500).json({
            success: false,
            message: 'Server error while processing refund',
            error: err.message,
        });
    }
};
