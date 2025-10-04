import mongoose from "mongoose";


const userSchema = new mongoose.Schema(
    {
        firstname: {
            type: String,
            required: [true, "Firstname is required"],
        },
        lastname: {
            type: String,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
        },
        googleId: {
            type: String,
            required: [true, "Google ID is required"],
        },
        phoneNumber: {
            type: String,
            minlength: 10,
            maxlength: 15,
        },
        profile: String,
        role: {
            type: String,
            enum: ["User", "Admin"],
            default: "User",
        },
        cartList: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Cart",
        },
        orderList: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
        },
        productsViewed: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
        }],
       
    },
    {
        timestamps: true,
    }
);

// Virtual for full name
userSchema.virtual("fullName").get(function () {
    return `${this.firstname} ${this.lastname}`;
});


const User = mongoose.model("User", userSchema);
export default User;
