import express from "express";
import { getActiveSale } from "../../controllers/sale.controller.js";
import checkActiveSale from "../../middleware/checkActiveSale.js";

const saleRoute = express.Router();

// checkActiveSale(false) -> if sale is active, throw error
// checkActiveSale(true) -> if sale is not active, throw error

saleRoute.get(
    "/",
    checkActiveSale(true),
    getActiveSale
);

export default saleRoute;
