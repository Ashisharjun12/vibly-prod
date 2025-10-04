import { emailHelper } from "../../utils/nodemailer.js";


export const EmailWorker = async (job) => {
  const { email, subject, template, data } = job.data;
  
  try {
    console.log(` Sending email to: ${email}`);
    
    //  email data
    const emailData = {
      email,
      subject,
      template,
      data: data || {}
    };
    
    // Send the email
    await emailHelper(emailData);
    
    console.log(` Email sent to: ${email}`);
    
    return { success: true, email };
    
  } catch (error) {
    console.error(` Failed to send email to ${email}:`, error.message);
    throw error;
  }
};