import Sale from "../models/sale.model.js";

// Middleware to check if there's an active sale
const checkActiveSale =
    (throwErrorOnActive = true) =>
        async (req, res, next) => {
            try {
                const activeSale = await Sale.findOne({ isActive: true });

                if (throwErrorOnActive && !activeSale) {
                    return res.status(404).json({ success: false, message: "No sale is going on." });
                } else if (!throwErrorOnActive && activeSale) {
                    return res.status(404).json({ success: false, message: "Sale is already going on." });
                }

                // Proceed to the next middleware or route handler
                next();
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: "Something went wrong while checking for an active sale.",
                });
            }
        };

export default checkActiveSale;
