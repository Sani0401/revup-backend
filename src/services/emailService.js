const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs').promises;

class EmailService {
  constructor() {
    this.transporter = null;
    this.templatesPath = path.join(__dirname, '../templates/emails');
    this.initTransporter();
  }

  async initTransporter() {
    // Create transporter based on environment
    if (process.env.NODE_ENV === 'production' || process.env.SMTP_USER) {
      // Production email configuration or when SMTP credentials are provided
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    } else {
      // Development: Use Ethereal Email for testing
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }
  }

  async loadTemplate(templateName, data = {}) {
    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.ejs`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      return ejs.render(templateContent, data);
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      throw new Error(`Template ${templateName} not found`);
    }
  }

  async sendEmail(to, subject, templateName, data = {}) {
    try {
      if (!this.transporter) {
        await this.initTransporter();
      }

      const htmlContent = await this.loadTemplate(templateName, data);
      
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@revup-bolt.com',
        to,
        subject,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', {
        messageId: info.messageId,
        to,
        subject,
        template: templateName
      });

      // In development, log the preview URL
      if (process.env.NODE_ENV !== 'production') {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Account creation invite email
  async sendAccountInvite(userData, inviteData) {
    const subject = `Welcome to ${userData.enterprises?.name || 'RevUp Bolt'} - Your Account is Ready!`;
    
    const data = {
      userName: userData.name,
      userEmail: userData.email,
      enterpriseName: userData.enterprises?.name || 'RevUp Bolt',
      enterpriseDomain: userData.enterprises?.domain,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@revup-bolt.com',
      ...inviteData
    };

    return this.sendEmail(userData.email, subject, 'account-invite', data);
  }

  // Password reset email
  async sendPasswordReset(userData, resetData) {
    const subject = `Reset Your Password - ${userData.enterprises?.name || 'RevUp Bolt'}`;
    
    const data = {
      userName: userData.name,
      userEmail: userData.email,
      enterpriseName: userData.enterprises?.name || 'RevUp Bolt',
      resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetData.token}`,
      expiresIn: '1 hour',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@revup-bolt.com'
    };

    return this.sendEmail(userData.email, subject, 'password-reset', data);
  }

  // Welcome email for new users
  async sendWelcomeEmail(userData) {
    const subject = `Welcome to ${userData.enterprises?.name || 'RevUp Bolt'}!`;
    
    const data = {
      userName: userData.name,
      userEmail: userData.email,
      enterpriseName: userData.enterprises?.name || 'RevUp Bolt',
      roleName: userData.roles?.name || 'User',
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@revup-bolt.com',
      gettingStartedUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/getting-started`
    };

    return this.sendEmail(userData.email, subject, 'welcome', data);
  }

  // Meeting invitation email
  async sendMeetingInvite(userData, meetingData) {
    const subject = `Meeting Invitation: ${meetingData.title}`;
    
    const data = {
      userName: userData.name,
      userEmail: userData.email,
      enterpriseName: userData.enterprises?.name || 'RevUp Bolt',
      meetingTitle: meetingData.title,
      meetingDescription: meetingData.description,
      meetingStartTime: new Date(meetingData.start_time).toLocaleString(),
      meetingEndTime: new Date(meetingData.end_time).toLocaleString(),
      meetingLink: meetingData.meeting_link,
      organizerName: meetingData.organizer_name,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    };

    return this.sendEmail(userData.email, subject, 'meeting-invite', data);
  }

  // Lead assignment notification
  async sendLeadAssignment(userData, leadData) {
    const subject = `New Lead Assigned: ${leadData.name}`;
    
    const data = {
      userName: userData.name,
      userEmail: userData.email,
      enterpriseName: userData.enterprises?.name || 'RevUp Bolt',
      leadName: leadData.name,
      leadCompany: leadData.company,
      leadEmail: leadData.email,
      leadPhone: leadData.phone,
      leadScore: leadData.score,
      leadUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/leads/${leadData.id}`,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    };

    return this.sendEmail(userData.email, subject, 'lead-assignment', data);
  }

  // Task reminder email
  async sendTaskReminder(userData, taskData) {
    const subject = `Task Reminder: ${taskData.title}`;
    
    const data = {
      userName: userData.name,
      userEmail: userData.email,
      enterpriseName: userData.enterprises?.name || 'RevUp Bolt',
      taskTitle: taskData.title,
      taskDescription: taskData.description,
      taskDueDate: new Date(taskData.due_date).toLocaleString(),
      taskPriority: taskData.priority,
      taskUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks/${taskData.id}`,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    };

    return this.sendEmail(userData.email, subject, 'task-reminder', data);
  }
}

module.exports = new EmailService(); 