import { createReturnOrder } from './shipRocket.js';
import { getReturnOrderData } from '../config/shiprocket.config.js';

/**
 * Create a return order in ShipRocket
 * @param {Object} order - Order object
 * @param {Array} items - Array of order items
 * @param {string} token - ShipRocket token
 * @returns {Promise<Object>} - ShipRocket response
 */
export const createShiprocketReturnOrder = async (order, items, {length, breadth, height, weight}, token) => {
    try {
        // Get user information for pickup details
        const user = await order.populate('user');
        
        // Use configuration to prepare ShipRocket return order data
        const returnOrderData = getReturnOrderData(order, items, {length, breadth, height, weight}, user.user);

        console.log("Creating ShipRocket return order with data:", {
            orderId: returnOrderData.order_id,
            itemsCount: returnOrderData.order_items.length,
            totalAmount: returnOrderData.sub_total
        });

        // Create ShipRocket return order
        const response = await createReturnOrder(returnOrderData, token);
        
        if (response.success) {
            console.log("ShipRocket return order created successfully:", {
                orderId: response.data?.order_id,
                shipmentId: response.data?.shipment_id,
                trackingNumber: response.data?.tracking_number
            });
        } else {
            console.error("ShipRocket return order creation failed:", response.error);
        }
        
        return response;
    } catch (error) {
        console.error("Error creating ShipRocket return order:", error);
        throw error;
    }
};

/**
 * Prepare ShipRocket order data for order creation
 * @param {Object} order - Order object
 * @param {Object} user - User object
 * @param {Object} shippingData - Shipping data (dimensions, weight, address)
 * @returns {Object} - Formatted ShipRocket order data
 */
export const prepareShiprocketOrderData = (order, user, shippingData) => {
    return {
        order_id: order.orderId,
        order_date: order.createdAt,
        pickup_location: shippingData.address,
        billing_customer_name: user.name,
        billing_last_name: "",
        billing_address: order.shippingInfo.address,
        billing_address_2: "",
        billing_city: order.shippingInfo.city,
        billing_pincode: order.shippingInfo.postalCode,
        billing_state: order.shippingInfo.state,
        billing_country: order.shippingInfo.country,
        billing_email: user.email || "",
        billing_phone: order.shippingInfo.phone,
        shipping_is_billing: true,
        order_items: order.items
            .filter(item => item.orderStatus === 'Ordered')
            .map(item => ({
                name: item.product.name,
                sku: `${item.product.name}-${item.size}-${item.color.name}`,
                units: item.quantity,
                selling_price: item.amount,
                discount: "",
                tax: "",
                hsn: ""
            })),
        payment_method: order.paymentMethod,
        shipping_charges: order.amount.shippingCharges,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: 0,
        sub_total: order.amount.totalAmount,
        length: shippingData.length,
        breadth: shippingData.breadth,
        height: shippingData.height,
        weight: shippingData.weight
    };
};

/**
 * Update order with ShipRocket data
 * @param {Object} order - Order object
 * @param {Object} shiprocketData - ShipRocket response data
 * @returns {Object} - Updated ShipRocket data
 */
export const updateOrderWithShiprocketData = (shiprocketData) => {
    return {
        orderId: shiprocketData.order_id,
        shipmentId: shiprocketData.shipment_id,
        trackingNumber: '',
        courierName: shiprocketData.courier_name,
        returnOrderId: '',
        returnShipmentId: '',
        returnTrackingNumber: ''
    };
};

/**
 * Update order with AWB data
 * @param {Object} order - Order object
 * @param {Object} awbData - AWB response data
 * @returns {Object} - Updated tracking information
 */
export const updateOrderWithAWBData = (order, awbData) => {
    return {
        ...order.shiprocket,
        trackingNumber: `https://www.shiprocket.in/shipment-tracking/${awbData.awb_code}`,
        courierId: awbData.courier_id
    };
};

/**
 * Update order with return data
 * @param {Object} order - Order object
 * @param {Object} returnData - Return response data
 * @returns {Object} - Updated return information
 */
export const updateOrderWithReturnData = (order, returnData) => {
    return {
        ...order.shiprocket,
        returnOrderId: returnData.order_id || returnData.return_order_id,
        returnShipmentId: returnData.shipment_id || returnData.return_shipment_id,
        returnTrackingNumber: returnData.tracking_number || returnData.return_tracking_number,
        returnAwbCode: returnData.awb_code,
        returnCourierId: returnData.courier_id,
        returnCourierName: returnData.courier_name
    };
};