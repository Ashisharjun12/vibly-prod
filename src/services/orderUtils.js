import crypto from 'crypto';
import { OrderStatus } from '../models/newOrder.model.js';
// ----- STATUS TRANSITION HELPER -----
export const canTransition = (current, target) => {
    return OrderStatus[current]?.next.includes(target);
};

// ----- AGGREGATE ORDER STATUS (BATCH LEVEL) -----
export const getOverallOrderStatus = (items) => {
    const statuses = items.map(i => i.orderStatus);

    if (statuses.every(s => s === 'DELIVERED')) return 'DELIVERED';
    if (statuses.every(s => s === 'CANCELLED')) return 'CANCELLED';
    if (statuses.every(s => s === 'RETURNED')) return 'RETURNED';
    if (statuses.includes('RETURN_REQUESTED')) return 'RETURN_REQUESTED';
    if (statuses.includes('SHIPPED')) return 'SHIPPED';
    return 'ORDERED';
};

// ----- ID GENERATORS -----
export const generateOrderId = () => {
    return `ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

export const generateItemId = () => {
    return `ITM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

export const generateCancelId = () => {
    return `CNL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

export const generateReturnId = () => {
    return `RTN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

// ----- VALIDATION HELPERS -----
export const validateItemOwnership = (orderItems, userId) => {
    return orderItems.every(item => item.user.toString() === userId.toString());
};

export const filterValidItemIds = (items, validIds) => {
    return items.filter(id => validIds.includes(id.toString()));
};
