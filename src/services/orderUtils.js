import crypto from 'crypto';
import { OrderStatus } from '../models/newOrder.model.js';

// Create status map for quick lookup
const statusMap = Object.values(OrderStatus).reduce((map, statusObj) => {
    map[statusObj.value] = statusObj.next;
    return map;
}, {});

/**
 * Check if a status transition is valid
 * @param {string} currentStatus - Current status of the item
 * @param {string} nextStatus - Desired next status
 * @returns {boolean} - True if transition is valid
 */
export const canTransition = (currentStatus, nextStatus) => {
    if (!statusMap[currentStatus]) return false;
    return statusMap[currentStatus].includes(nextStatus);
};

/**
 * Get all possible next statuses for a given status
 * @param {string} currentStatus - Current status
 * @returns {string[]} - Array of possible next statuses
 */
export const getNextStatuses = (currentStatus) => {
    return statusMap[currentStatus] || [];
};

/**
 * Validate status transition with detailed error message
 * @param {string} currentStatus - Current status
 * @param {string} nextStatus - Desired next status
 * @returns {Object} - {isValid: boolean, message: string}
 */
export const validateStatusTransition = (currentStatus, nextStatus) => {
    if (!canTransition(currentStatus, nextStatus)) {
        const possibleStatuses = getNextStatuses(currentStatus);
        return {
            isValid: false,
            message: `Cannot transition from ${currentStatus} to ${nextStatus}. Possible next statuses: ${possibleStatuses.join(', ')}`
        };
    }
    return { isValid: true, message: 'Valid transition' };
};

/**
 * Get overall order status based on item statuses
 * @param {Array} items - Array of order items
 * @returns {string} - Overall order status
 */
export const getOverallOrderStatus = (items) => {
    const statuses = items.map(item => item.orderStatus);

    // Priority order for overall status
    if (statuses.some(s => s === OrderStatus.RETURN_REQUESTED.value)) return OrderStatus.RETURN_REQUESTED.value;
    if (statuses.every(s => s === OrderStatus.DELIVERED.value)) return OrderStatus.DELIVERED.value;
    if (statuses.every(s => s === OrderStatus.CANCELLED.value)) return OrderStatus.CANCELLED.value;
    if (statuses.every(s => s === OrderStatus.RETURNED.value)) return OrderStatus.RETURNED.value;
    if (statuses.every(s => s === OrderStatus.REFUNDED.value)) return OrderStatus.REFUNDED.value;
    if (statuses.includes(OrderStatus.SHIPPED.value)) return OrderStatus.SHIPPED.value;

    return OrderStatus.ORDERED.value; // Default fallback
};

/**
 * Create status history entry
 * @param {string} status - Status value
 * @param {string} note - Status note
 * @returns {Object} - Status history entry
 */
export const createStatusHistoryEntry = (status, note = '') => {
    return {
        status,
        note,
        changedAt: new Date()
    };
};

/**
 * Calculate total amount for order items
 * @param {Array} items - Array of order items
 * @returns {number} - Total amount
 */
export const calculateTotalAmount = (items) => {
    return items.reduce((total, item) => total + (item.amount * item.quantity), 0);
};

/**
 * Calculate total quantity for order items
 * @param {Array} items - Array of order items
 * @returns {number} - Total quantity
 */
export const calculateTotalQuantity = (items) => {
    return items.reduce((total, item) => total + item.quantity, 0);
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
