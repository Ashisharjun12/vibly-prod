import mongoose from "mongoose";

const colorSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Color name is required"],
            unique: true,
            trim: true,
        },
        hexCode: {
            type: String,
            required: [true, "Hex code is required"],
            unique: true,
            uppercase: true,
            validate: {
                validator: function (v) {
                    return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(v);
                },
                message: (props) => `${props.value} is not a valid hex color code!`,
            },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

const Color = mongoose.model("Color", colorSchema);
export default Color;
