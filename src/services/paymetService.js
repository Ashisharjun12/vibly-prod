
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { _config } from "../config/config.js";
import { PaymentConfig } from '../models/paymentConfig.model.js';
import { PaymentTransaction, PaymentStatus, PaymentProvider } from '../models/paymentTransaction.model.js';

class PaymentService {
  constructor() {
    this.razorpay = null;
    this.cashfree = null;
    this.initializeProviders();
  }

  async initializeProviders() {
    try {
      const config = await PaymentConfig.findOne();
      if (!config) {
        // Create default config
        await this.createDefaultConfig();
        return;
      }

      // Initialize Razorpay if enabled
      const razorpayConfig = config.providers.find(p => p.name === 'razorpay');
      if (razorpayConfig && razorpayConfig.isEnabled) {
        this.razorpay = new Razorpay({
          key_id: razorpayConfig.credentials.keyId || _config.RAZORPAY_KEY_ID,
          key_secret: razorpayConfig.credentials.keySecret || _config.RAZORPAY_KEY_SECRET,
        });
      }

      // Initialize Cashfree if enabled
      const cashfreeConfig = config.providers.find(p => p.name === 'cashfree');
      if (cashfreeConfig && cashfreeConfig.isEnabled) {
        this.cashfree = {
          appId: cashfreeConfig.credentials.keyId || _config.CASHFREE_APP_ID,
          secretKey: cashfreeConfig.credentials.keySecret || _config.CASHFREE_SECRET_KEY,
        };
      }
    } catch (error) {
      console.error('Error initializing payment providers:', error);
    }
  }

  async createDefaultConfig() {
    const defaultConfig = new PaymentConfig({
      onlinePaymentEnabled: false,
      codEnabled: true,
      providers: [
        {
          name: 'razorpay',
          isEnabled: false,
          credentials: {
            keyId: _config.RAZORPAY_KEY_ID,
            keySecret: _config.RAZORPAY_KEY_SECRET
          }
        },
        {
          name: 'cashfree',
          isEnabled: false,
          credentials: {
            keyId: _config.CASHFREE_APP_ID,
            keySecret: _config.CASHFREE_SECRET_KEY
          }
        }
      ],
      defaultProvider: 'razorpay'
    });
    
    await defaultConfig.save();
    console.log('Default payment config created');
  }

  async getPaymentConfig() {
    return await PaymentConfig.findOne();
  }

  async updatePaymentConfig(configData) {
    const config = await PaymentConfig.findOne();
    if (!config) {
      throw new Error('Payment config not found');
    }

    Object.assign(config, configData);
    await config.save();
    
    // Reinitialize providers
    await this.initializeProviders();
    
    return config;
  }

  async createRazorpayOrder(orderData) {
    if (!this.razorpay) {
      throw new Error('Razorpay is not enabled');
    }

    const options = {
      amount: orderData.amount, // Amount is already in paise from frontend
      currency: orderData.currency || 'INR',
      receipt: orderData.orderId,
      notes: {
        orderId: orderData.orderId,
        userId: orderData.userId
      }
    };

    const order = await this.razorpay.orders.create(options);
    return order;
  }

  async verifyRazorpayPayment(paymentData) {
    if (!this.razorpay) {
      throw new Error('Razorpay is not enabled');
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
    
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", _config.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;
    
    if (!isAuthentic) {
      throw new Error('Invalid payment signature');
    }

    return {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    };
  }

  async createCashfreeOrder(orderData) {
    if (!this.cashfree) {
      throw new Error('Cashfree is not enabled');
    }

    const orderPayload = {
      order_id: orderData.orderId,
      order_amount: orderData.amount,
      order_currency: orderData.currency || 'INR',
      customer_details: {
        customer_id: orderData.userId,
        customer_name: orderData.customerName,
        customer_email: orderData.customerEmail,
        customer_phone: orderData.customerPhone
      },
      order_meta: {
        return_url: `${_config.CLIENT_URL}/payment/success`,
        notify_url: `${_config.CLIENT_URL}/api/payments/cashfree/webhook`
      }
    };

    const response = await fetch('https://sandbox.cashfree.com/pg/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': this.cashfree.appId,
        'x-client-secret': this.cashfree.secretKey
      },
      body: JSON.stringify(orderPayload)
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to create Cashfree order');
    }

    console.log('Cashfree order created:', result);
    return result;
  }

  async verifyCashfreePayment(paymentData) {
    if (!this.cashfree) {
      throw new Error('Cashfree is not enabled');
    }

    const { order_id, payment_id, orderId } = paymentData;
    const orderIdToUse = order_id || orderId;

    console.log('Verifying Cashfree payment for order:', orderIdToUse);

    // First, get all payments for the order (like your test code)
    const response = await fetch(`https://sandbox.cashfree.com/pg/orders/${orderIdToUse}/payments`, {
      method: 'GET',
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': this.cashfree.appId,
        'x-client-secret': this.cashfree.secretKey
      }
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to verify Cashfree payment');
    }

    console.log('Cashfree payments for order:', result);

    // Check if any payment is successful
    const successfulPayment = result.find(payment => payment.payment_status === 'SUCCESS');
    
    if (successfulPayment) {
      return {
        ...result,
        payment_status: 'SUCCESS',
        transactionId: successfulPayment.cf_payment_id,
        paymentId: successfulPayment.cf_payment_id,
        orderId: orderIdToUse
      };
    }

    return {
      ...result,
      payment_status: 'PENDING',
      transactionId: null,
      paymentId: null,
      orderId: orderIdToUse
    };
  }

  async createPaymentTransaction(transactionData) {
    const transaction = new PaymentTransaction(transactionData);
    await transaction.save();
    return transaction;
  }

  async updatePaymentTransaction(transactionId, updateData) {
    const transaction = await PaymentTransaction.findOneAndUpdate(
      { transactionId },
      updateData,
      { new: true }
    );
    return transaction;
  }

  async getPaymentTransaction(transactionId) {
    return await PaymentTransaction.findOne({ transactionId });
  }

  async getPaymentTransactionsByOrder(orderId) {
    return await PaymentTransaction.find({ orderId }).sort({ createdAt: -1 });
  }
}

export const paymentService = new PaymentService();
