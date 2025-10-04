import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";
import { _config } from "../config/config.js";
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const emailHelper = async (options) => {
  try {
    // Create transporter with improved configuration
    const transporter = nodemailer.createTransport({
      host: _config.SMTP_HOST || "smtp.gmail.com",
      port: _config.SMTP_PORT || 587, 
      service: _config.SMTP_SERVICE || "gmail",
      secure: false,
      auth: {
        user: _config.SMTP_USER || "",
        pass: _config.SMTP_PASS || "",
      },
      // Additional configuration for better delivery and rate limiting
      pool: true,
      maxConnections: 2, // Reduced connections
      maxMessages: 50, // Reduced messages per connection
      rateDelta: 60000, // 60 seconds
      rateLimit: 10, // 10 emails per minute
      tls: {
        rejectUnauthorized: false
      }
    });

    const { email, subject, template, data } = options;

    const templatePath = path.join(__dirname, "../email", template);

    // Render HTML with EJS
    const html = await ejs.renderFile(templatePath, data);

    // Mail options with improved headers
    const mailOptions = {
      from: {
        name: 'Vibly',
        address: _config.SMTP_USER || ""
      },
      to: email,
      subject,
      html,
      // Add headers for better deliverability
      headers: {
        'X-Mailer': 'Vibly E-commerce',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal'
      },
      // Add message ID for tracking
      messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@vibly.com`
    };

    // Send mail with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const result = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${email}. Message ID: ${result.messageId}`);
        return result;
      } catch (error) {
        attempts++;
        console.error(`Email send attempt ${attempts} failed:`, error.message);
        
        if (attempts >= maxAttempts) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
  } catch (error) {
    console.error('Email helper error:', error);
    throw new Error(`Error while sending email: ${error.message}`);
  }
};

