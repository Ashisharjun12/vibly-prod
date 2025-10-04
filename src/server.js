import express from "express";
import { _config } from "./config/config.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import logger from "./utils/logger.js";
import morgan from "morgan";
import accessLogStream from "./utils/morgan.js";
import connectDB from "./config/database.js";
import authRoutes from "./routes/auth.route.js";
import session from 'express-session';
import passport from 'passport';
import configurePassport from "./config/passport.js";
import { adminMiddleware } from "./middleware/adminMiddleware.js";
import { authMiddleware } from "./middleware/authMiddleware.js";
import bannerRoutes from "./routes/user/banner.route.js";
import adminBannerRoutes from "./routes/admin/banner.route.js";
import categoryRoutes from "./routes/user/category.route.js";
import adminCategoryRoutes from "./routes/admin/category.route.js";
import colorRoutes from "./routes/user/color.route.js";
import productRoutes from "./routes/user/product.route.js";
import adminColorRoutes from "./routes/admin/color.route.js";
import adminProductRoutes from "./routes/admin/product.route.js";
import orderRoutes from "./routes/user/order.route.js";
import adminOrderRoutes from "./routes/admin/order.route.js";
import cartRoutes from "./routes/user/cart.route.js";
import newOrderRoutes from "./routes/user/newOrder.route.js";
import adminNewOrderRoutes from "./routes/admin/newOrder.route.js";
import adminSaleRoutes from "./routes/admin/sale.route.js";
import saleRoutes from "./routes/user/sale.route.js";
import adminUserRoutes from "./routes/admin/user.route.js";
import paymentRoutes from "./routes/user/payment.route.js";
import adminPaymentRoutes from "./routes/admin/payment.route.js";
import reviewRoutes from "./routes/review.route.js";
import adminStatsRoutes from "./routes/admin/stats.route.js";
import initSentry from "./utils/sentry.js";
import * as Sentry from "@sentry/node"

// Initialize Sentry
initSentry();


const app = express();

const PORT = _config.PORT;

// Database connection
connectDB().then(() => {
  logger.info("MongoDB connected successfully");
});

// Middlewares
// CORS configuration
const allowedOrigins = [
  "http://localhost:5173", 
  "https://vibly-frontend.vercel.app",
  "https://vibly.in",
  "https://vibly.in/",
  "https://www.vibly.in",
  "https://www.vibly.in/"
];


app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(helmet());
app.use(morgan('combined', { stream: accessLogStream }));
app.use(session({
  secret: _config.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: _config.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: _config.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
}));

// Authentication Middlewares
app.use(passport.initialize());
app.use(passport.session());
configurePassport(passport);


// Health check
app.get("/health", (req, res) => {
  return res.status(200).send("OK");
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  return res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});


//Routes
app.use("/api/auth", authRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/colors", colorRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", authMiddleware, orderRoutes);
app.use("/api/cart", authMiddleware, cartRoutes);
app.use("/api/newOrders", authMiddleware, newOrderRoutes);
app.use("/api/sale", authMiddleware, saleRoutes);
app.use("/api/payments", authMiddleware, paymentRoutes);
app.use("/api/reviews", reviewRoutes);

//Admin Routes
app.use("/api/admin/banners", adminMiddleware, adminBannerRoutes);
app.use("/api/admin/categories", adminMiddleware, adminCategoryRoutes);
app.use("/api/admin/colors", adminMiddleware, adminColorRoutes);
app.use("/api/admin/products", adminMiddleware, adminProductRoutes);
app.use("/api/admin/orders", adminMiddleware, adminOrderRoutes);
app.use("/api/admin/newOrders", adminMiddleware, adminNewOrderRoutes);
app.use("/api/admin/sales", adminMiddleware, adminSaleRoutes);
app.use("/api/admin/users", adminMiddleware, adminUserRoutes);
app.use("/api/admin/payments", adminMiddleware, adminPaymentRoutes);
app.use("/api/admin/stats", adminMiddleware, adminStatsRoutes);




//setup sentry error handler
Sentry.setupExpressErrorHandler(app); //sentery setup

//unhandled rejection
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err}`);
  process.exit(1);
});

export default app; 