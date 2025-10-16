/**
 * ShipRocket Configuration
 * This file contains configurable settings for ShipRocket integration
 */

export const shiprocketConfig = {
  // Default channel ID for ShipRocket
  channelId: "000000",
  
  // Store/Company information
  company: {
    name: "Vibly",
    brand: "Clothing Store",
    address: "48, Vill - Muslim Tola Boulia, Dilarpur, Manihari",
    address2: "",
    city: "Katihar",
    state: "Bihar",
    country: "India",
    pincode: 854113,
    email: "vibly85@gmail.com",
    phone: "6287915088",
    isdCode: "91"
  },

  // Return order settings
  return: {
    paymentMethod: "PREPAID",
    qcEnable: true,
    defaultReason: "Return requested by customer",
    defaultComments: "Return requested by customer"
  }
};

/**
 * Get ShipRocket return order data with proper configuration
 * @param {Object} order - Order object
 * @param {Array} items - Array of items to return
 * @param {Object} user - User object
 * @returns {Object} - Formatted return order data
 */
export const getReturnOrderData = (order, items, {length, breadth, height, weight}, user) => {
  return {
    order_id: order.orderId,
    order_date: order.orderedAt.toISOString().split('T')[0],
    channel_id: shiprocketConfig.channelId,
    pickup_customer_name: user.firstname || "Customer",
    pickup_last_name: user.lastname || "",
    company_name: shiprocketConfig.company.name,
    pickup_address: order.shippingInfo.address,
    pickup_address_2: shiprocketConfig.company.address2,
    pickup_city: order.shippingInfo.city,
    pickup_state: order.shippingInfo.state,
    pickup_country: order.shippingInfo.country,
    pickup_pincode: parseInt(order.shippingInfo.postalCode),
    pickup_email: user.email || "",
    pickup_phone: order.shippingInfo.phone,
    pickup_isd_code: shiprocketConfig.company.isdCode,
    shipping_customer_name: shiprocketConfig.company.name,
    shipping_last_name: "",
    shipping_address: shiprocketConfig.company.address,
    shipping_address_2: shiprocketConfig.company.address2,
    shipping_city: shiprocketConfig.company.city,
    shipping_country: shiprocketConfig.company.country,
    shipping_pincode: shiprocketConfig.company.pincode,
    shipping_state: shiprocketConfig.company.state,
    shipping_email: shiprocketConfig.company.email,
    shipping_isd_code: shiprocketConfig.company.isdCode,
    shipping_phone: shiprocketConfig.company.phone,
    order_items: items.map(item => ({
      name: item.product.name,
      qc_enable: shiprocketConfig.return.qcEnable,
      qc_product_name: item.product.name,
      sku: `${item.product.name}-${item.size}-${item.color.name}`,
      units: item.quantity,
      selling_price: item.amount,
      discount: 0,
      qc_brand: shiprocketConfig.company.brand,
      qc_product_image: item.product.image?.secure_url || ""
    })),
    payment_method: shiprocketConfig.return.paymentMethod,
    total_discount: "0",
    sub_total: items.reduce((sum, item) => sum + (item.amount * item.quantity), 0),
    length: length,
    breadth: breadth,
    height: height,
    weight: weight
  };
};
