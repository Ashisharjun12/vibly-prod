export const OrderStatus = {
    ORDERED: { value: 'Ordered', next: ['CANCELLED'] },
    SHIPPED: { value: 'Shipped', next: ['DELIVERED'] },
    DELIVERED: { value: 'Delivered', next: ['RETURN_REQUESTED'] },

    CANCELLED: { value: 'Cancelled', next: [] },

    RETURN_REQUESTED: { value: 'Return Requested', next: ['RETURNED', 'RETURN_CANCELLED'] },
    RETURNED: { value: 'Returned', next: ['REFUNDED'] },
    REFUNDED: { value: 'Refunded', next: [] },

    RETURN_CANCELLED: { value: 'Return Cancelled', next: [] },
};

export const PaymentStatus = {
    PAID: 'Paid',
    PENDING: 'Pending',
    FAILED: 'Failed',
    REFUNDED: 'Refunded',
};

export const PaymentMethod = {
    COD: 'Cash On Delivery',
    CARD: 'Card',
    UPI: 'UPI',
};