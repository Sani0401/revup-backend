const express = require('express');
const { body } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateAccountInvite = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('roleId')
    .isInt()
    .withMessage('Valid role ID is required'),
  body('enterpriseId')
    .isUUID()
    .withMessage('Valid enterprise ID is required'),
  body('invitedBy')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Invited by must be less than 100 characters')
];

const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
];

const validateMeetingInvite = [
  body('meetingId')
    .isUUID()
    .withMessage('Valid meeting ID is required'),
  body('attendeeIds')
    .isArray({ min: 1 })
    .withMessage('At least one attendee is required'),
  body('attendeeIds.*')
    .isUUID()
    .withMessage('Valid attendee ID is required')
];

const validateLeadAssignment = [
  body('leadId')
    .isUUID()
    .withMessage('Valid lead ID is required'),
  body('assignedToId')
    .isUUID()
    .withMessage('Valid user ID is required')
];

// Account invitation routes
router.post('/account-invite', notificationController.sendAccountInvite);
router.post('/welcome-email/:userId', auth, notificationController.sendWelcomeEmail);

// Password reset routes
router.post('/password-reset', validatePasswordReset, notificationController.sendPasswordResetEmail);

// Meeting invitation routes
router.post('/meeting-invite', auth, validateMeetingInvite, notificationController.sendMeetingInvite);

// Lead assignment routes
router.post('/lead-assignment', auth, validateLeadAssignment, notificationController.sendLeadAssignmentNotification);

// Task reminder routes
router.post('/task-reminder/:taskId', auth, notificationController.sendTaskReminder);

// Notification management routes
router.get('/user', auth, notificationController.getUserNotifications);
router.put('/:notificationId/read', auth, notificationController.markNotificationAsRead);
router.put('/mark-all-read', auth, notificationController.markAllNotificationsAsRead);

// Test email endpoint (remove in production)
router.post('/test-email', async (req, res) => {
  try {
    const { to, subject, template } = req.body;
    
    if (!to || !subject || !template) {
      return res.status(400).json({
        success: false,
        message: 'to, subject, and template are required'
      });
    }

    const emailService = require('../services/emailService');
    
    // Test data
    const testData = {
      userName: 'Test User',
      userEmail: to,
      enterpriseName: 'RevUp Bolt Test',
      roleName: 'Test Role',
      loginUrl: 'http://localhost:3000',
      supportEmail: 'sanipatel0401@gmail.com',
      tempPassword: 'TestPass123!',
      invitedBy: 'Test Manager',
      resetUrl: 'http://localhost:3000/reset-password?token=test-token',
      expiresIn: '1 hour',
      gettingStartedUrl: 'http://localhost:3000/getting-started'
    };

    await emailService.sendEmail(to, subject, template, testData);

    res.json({
      success: true,
      message: 'Test email sent successfully'
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message
    });
  }
});

module.exports = router; 