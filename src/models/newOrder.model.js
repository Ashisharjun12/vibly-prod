import mongoose from 'mongoose';
const { Schema } = mongoose;

export const PaymentMethod = {
  COD: 'COD',
  ONLINE: 'ONLINE',
};

export const PaymentStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
};

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

const ORDER_STATUS_VALUES = Object.values(OrderStatus).map(s => s.value);

const statusHistorySchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUS_VALUES, required: true },
    note: { type: String },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderItemSchema = new Schema(
  {
    product: {
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      name: { type: String, required: true },
      image: {
        id: String,
        secure_url: String,
      },
    },
    color: {
      name: String,
      hexCode: String,
    },
    size: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },

    amount: {
      price: { type: Number, required: true },
      shippingCharges: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
    },

    orderStatus: {
      type: String,
      enum: ORDER_STATUS_VALUES,
      default: OrderStatus.ORDERED.value,
    },
    statusHistory: [statusHistorySchema],

    cancelId: String,
    cancelledAt: Date,

    returnId: String,
    returnRequestedAt: Date,
    returnedAt: Date,
    returnRequestNote: String,

    refundAmount: Number,
    refundStatus: { type: String, enum: Object.values(PaymentStatus) },
    refundProcessedAt: Date,
    
    // Refund Request Details
    refundRequestedAt: Date,
    refundRequestNote: String,
    refundAccountDetails: {
      accountType: { type: String, enum: ['BANK', 'UPI'], required: false },
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      accountHolderName: String,
      upiId: String,
      phoneNumber: String,
    },
    refundApprovedAt: Date,
    refundApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    refundRejectedAt: Date,
    refundRejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    refundRejectionReason: String,
  }
  // removed `_id: false` so each item has its own _id
);

const newOrderSchema = new Schema(
  {
    orderId: { type: String, unique: true, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],

    shippingInfo: {
      address: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
      phone: String,
    },

    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    
    paymentProvider: {
      type: String,
      enum: ['razorpay', 'cashfree'],
      default: null,
    },
    
    transactionId: {
      type: String,
      default: null,
    },
    
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },

    orderedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

newOrderSchema.methods.updateItemStatus = function (itemIndex, newStatus, note) {
  const item = this.items[itemIndex];
  if (!item) throw new Error('Item not found in order');

  item.orderStatus = newStatus;
  item.statusHistory.push({
    status: newStatus,
    note,
    changedAt: new Date(),
  });
};

export const NewOrder = mongoose.model('NewOrder', newOrderSchema);
