import mongoose, { Schema } from 'mongoose';

// ─── ENUMS ───────────────────────────────────────
export const OrderStatus = {
    ORDERED: { value: 'Ordered', next: ['Cancelled', 'Shipped'] },
    SHIPPED: { value: 'Shipped', next: ['Delivered'] },
    DELIVERED: { value: 'Delivered', next: ['Return Requested'] },
    CANCELLED: { value: 'Cancelled', next: ['Refunded'] },
    RETURN_REQUESTED: { value: 'Return Requested', next: ['Departed For Returning', 'Return Cancelled'] },
    DEPARTED_FOR_RETURNING: { value: 'Departed For Returning', next: ['Returned', 'Return Cancelled'] },
    RETURNED: { value: 'Returned', next: ['Refunded'] },
    RETURN_CANCELLED: { value: 'Return Cancelled', next: [] },
    REFUNDED: { value: 'Refunded', next: [] },
};

export const PaymentStatus = {
    PAID: 'Paid',
    PENDING: 'Pending',
    FAILED: 'Failed',
    REFUNDED: 'Refunded',
};

export const PaymentMethod = {
    COD: 'Cash On Delivery',
    UPI: 'UPI',
};

// ─── SCHEMA ──────────────────────────────────────
const orderSchema = new Schema({
    // —— Grouping: use orderId as checkout-wide key ——  
    orderId: { type: String, required: true, index: true },

    // —— Identity ——  
    itemId: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // —— Product snapshot ——  
    product: {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        image: {
            id: { type: String, required: true },
            secure_url: { type: String, required: true },
        }
    },

    color: {
        name: { type: String, required: true, trim: true },
        hexCode: {
            type: String,
            required: true,
            uppercase: true,
            validate: v => /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(v),
        }
    },

    size: {
        type: String,
        enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        required: true
    },

    // —— Financials ——  
    amount: {
        price: { type: Number, required: true, min: 0 },
        shippingCharges: { type: Number, default: 0, min: 0 },
        totalAmount: { type: Number, required: true, min: 0 },
    },

    // —— Shipping snapshot ——  
    shippingInfo: {
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, required: true },
        postalCode: { type: String, required: true },
        phone: { type: String, required: true },
    },

    // —— Payment ——  
    paymentMethod: {
        type: String,
        enum: Object.keys(PaymentMethod),
        required: true,
    },
    paymentStatus: {
        type: String,
        enum: Object.keys(PaymentStatus),
        default: PaymentStatus.PENDING,
        index: true,
    },

    // —— Per-unit status ——  
    orderStatus: {
        type: String,
        enum: Object.keys(OrderStatus),
        default: OrderStatus.ORDERED,
        index: true,
    },

    // —— Audit trail ——  
    statusHistory: [{
        status: { type: String, enum: Object.keys(OrderStatus), required: true },
        note: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
    }],

    // —— Lifecycle artefacts ——  
    orderedAt: { type: Date, default: Date.now },
    shippedAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: Date.now },
    cancelId: String,
    cancelledAt: { type: Date, default: Date.now },
    returnId: String,
    returnRequestedAt: { type: Date, default: Date.now },
    returnedAt: { type: Date, default: Date.now },
    refundProcessedAt: { type: Date, default: Date.now },
    returnRequestNote: String,
    refundAmount: Number,
    refundStatus: {
        type: String,
        enum: ["Refunded", "Pending"],
    },

}, {
    timestamps: true
});

// ─── MIDDLEWARE ──────────────────────────────────
orderSchema.pre('save', function (next) {
    if (this.isModified('amount')) {
        const { price = 0, shippingCharges = 0 } = this.amount;
        this.amount.totalAmount = price + shippingCharges;
    }
    next();
});

// ─── METHODS ─────────────────────────────────────
orderSchema.methods.updateStatus = async function (newStatusKey, note = "") {
    const current = this.orderStatus;

    const allowed = OrderStatus[current]?.next || [];

    if (!allowed.includes(OrderStatus[newStatusKey].value)) {
        throw new Error(`Invalid transition: ${current} → ${newStatusKey}`);
    }

    this.orderStatus = newStatusKey;
    this.statusHistory.push({ status: newStatusKey, note });

    return this.save();
};

export const Order = mongoose.model('Order', orderSchema);
