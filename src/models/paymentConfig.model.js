import mongoose from 'mongoose';
const { Schema } = mongoose;

const paymentProviderSchema = new Schema({
  name: {
    type: String,
    enum: ['razorpay', 'cashfree'],
    required: true
  },
  isEnabled: {
    type: Boolean,
    default: false
  },
  credentials: {
    keyId: String,
    keySecret: String,
    webhookSecret: String
  },
  settings: {
    currency: {
      type: String,
      default: 'INR'
    },
    theme: {
      type: String,
      default: '#000000'
    },
    description: {
      type: String,
      default: 'Payment for order'
    }
  }
}, { _id: false });

const paymentConfigSchema = new Schema({
  // Global payment settings
  onlinePaymentEnabled: {
    type: Boolean,
    default: false
  },
  codEnabled: {
    type: Boolean,
    default: true
  },
  
  // Payment providers
  providers: [paymentProviderSchema],
  
  // Default provider (when multiple are enabled)
  defaultProvider: {
    type: String,
    enum: ['razorpay', 'cashfree'],
    default: 'razorpay'
  },
  
  // Payment limits
  limits: {
    minAmount: {
      type: Number,
      default: 1
    },
    maxAmount: {
      type: Number,
      default: 100000
    }
  }
}, {
  timestamps: true
});

// Ensure only one payment config exists
paymentConfigSchema.index({}, { unique: true });

export const PaymentConfig = mongoose.model('PaymentConfig', paymentConfigSchema);
