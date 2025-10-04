import { emailHelper } from "../../utils/nodemailer.js";

/**
 * Simple Email Worker for BullMQ
 * Just sends emails without complex monitoring
 */
export const EmailWorker = async (job) => {
  const { email, subject, template, data } = job.data;
  
  try {
    console.log(`📧 Sending email to: ${email}`);
    
    // Simple email data
    const emailData = {
      email,
      subject,
      template,
      data: data || {}
    };
    
    // Send the email
    await emailHelper(emailData);
    
    console.log(`✅ Email sent to: ${email}`);
    
    return { success: true, email };
    
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error.message);
    throw error;
  }
};