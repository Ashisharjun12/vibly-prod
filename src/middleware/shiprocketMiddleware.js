export const shiprocketMiddleware = async (req, res, next) => {
  try {
    const headers = req.headers;
    const token = headers["x-shiprocket-token"];
    if (!token) return res.status(401).json({ message: "Unauthorized" });
    req.shiprocketToken = token;
    next();
  } catch (error) {
    console.error("Error in Shiprocket Middleware:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
