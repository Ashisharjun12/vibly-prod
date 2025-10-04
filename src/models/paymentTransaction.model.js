import mongoose from 'mongoose';
const { Schema } = mongoose;

export const PaymentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

export const PaymentProvider = {
  RAZORPAY: 'razorpay',
  CASHFREE: 'cashfree',
  COD: 'cod'
};

const paymentTransactionSchema = new Schema({
  // Transaction details
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  orderId: {
    type: String,
    required: true,
    index: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  
  // Provider details
  provider: {
    type: String,
    enum: Object.values(PaymentProvider),
    required: true
  },
  providerTransactionId: String,
  providerOrderId: String,
  
  // Status
  status: {
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING
  },
  
  // Payment method
  paymentMethod: {
    type: String,
    enum: ['online', 'cod'],
    required: true
  },
  
  // Razorpay specific
  razorpay: {
    orderId: String,
    paymentId: String,
    signature: String,
    notes: Schema.Types.Mixed
  },
  
  // Cashfree specific
  cashfree: {
    orderId: String,
    paymentId: String,
    signature: String,
    notes: Schema.Types.Mixed
  },
  
  // COD specific
  cod: {
    deliveryDate: Date,
    collectedAt: Date,
    collectedBy: String
  },
  
  // Metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    deviceInfo: Schema.Types.Mixed
  },
  
  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  failedAt: Date,
  refundedAt: Date,
  
  // Error details
  error: {
    code: String,
    message: String,
    details: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
paymentTransactionSchema.index({ orderId: 1, user: 1 });
paymentTransactionSchema.index({ providerTransactionId: 1 });
paymentTransactionSchema.index({ status: 1 });
paymentTransactionSchema.index({ createdAt: -1 });

export const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
