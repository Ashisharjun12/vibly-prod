import mongoose from 'mongoose';
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    user: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    address: { 
      type: String, 
      required: true 
    },
    city: { 
      type: String, 
      required: true 
    },
    state: { 
      type: String, 
      required: true 
    },
    country: { 
      type: String, 
      required: true,
      default: 'India'
    },
    postalCode: { 
      type: String, 
      required: true 
    },
    phone: { 
      type: String, 
      required: true 
    },
    isDefault: { 
      type: Boolean, 
      default: false 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { timestamps: true }
);

// Ensure only one default address per user
addressSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

export const Address = mongoose.model('Address', addressSchema);
