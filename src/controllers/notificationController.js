const { validationResult } = require('express-validator');
const emailService = require('../services/emailService');
const authService = require('../services/authService');
const supabase = require('../config/supabase');

// Send account creation invite
const sendAccountInvite = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, name, roleId, enterpriseId, invitedBy } = req.body;

    // Check if user already exists
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Generate temporary password
    const tempPassword = generateTemporaryPassword();

    // Create user with temporary password
    const userData = {
      name,
      email,
      password: tempPassword,
      enterpriseId,
      roleId
    };

    const user = await authService.createUser(userData);

    // Send invite email
    await emailService.sendAccountInvite(user, {
      tempPassword,
      invitedBy,
      roleName: user.roles?.name || 'User'
    });

    // Create notification record
    await createNotificationRecord({
      enterpriseId,
      userId: user.id,
      title: 'Account Invitation Sent',
      message: `Account invitation sent to ${email}`,
      type: 'info',
      relatedId: user.id,
      relatedType: 'user'
    });

    res.json({
      success: true,
      message: 'Account invitation sent successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.roles?.name
        }
      }
    });
  } catch (error) {
    console.error('Send account invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending account invitation'
    });
  }
};

// Send welcome email to new user
const sendWelcomeEmail = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await authService.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await emailService.sendWelcomeEmail(user);

    res.json({
      success: true,
      message: 'Welcome email sent successfully'
    });
  } catch (error) {
    console.error('Send welcome email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending welcome email'
    });
  }
};

// Send password reset email
const sendPasswordResetEmail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email } = req.body;

    const user = await authService.findUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = authService.generatePasswordResetToken();
    await authService.savePasswordResetToken(user.id, resetToken);

    // Send password reset email
    await emailService.sendPasswordReset(user, { token: resetToken });

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Send password reset email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending password reset email'
    });
  }
};

// Send meeting invitation
const sendMeetingInvite = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { meetingId, attendeeIds } = req.body;

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        *,
        organizers:organizer_id (name),
        leads:lead_id (name, company)
      `)
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Get attendees
    const { data: attendees, error: attendeesError } = await supabase
      .from('users')
      .select(`
        *,
        enterprises:enterprise_id (name)
      `)
      .in('id', attendeeIds);

    if (attendeesError) {
      throw attendeesError;
    }

    // Send meeting invites to all attendees
    const emailPromises = attendees.map(attendee => 
      emailService.sendMeetingInvite(attendee, {
        ...meeting,
        organizer_name: meeting.organizers?.name
      })
    );

    await Promise.all(emailPromises);

    res.json({
      success: true,
      message: `Meeting invitations sent to ${attendees.length} attendees`
    });
  } catch (error) {
    console.error('Send meeting invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending meeting invitations'
    });
  }
};

// Send lead assignment notification
const sendLeadAssignmentNotification = async (req, res) => {
  try {
    const { leadId, assignedToId } = req.body;

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    // Get assigned user
    const assignedUser = await authService.findUserById(assignedToId);
    if (!assignedUser) {
      return res.status(404).json({
        success: false,
        message: 'Assigned user not found'
      });
    }

    // Send lead assignment email
    await emailService.sendLeadAssignment(assignedUser, lead);

    // Create notification record
    await createNotificationRecord({
      enterpriseId: assignedUser.enterprise_id,
      userId: assignedToId,
      title: 'New Lead Assigned',
      message: `Lead "${lead.name}" from ${lead.company} has been assigned to you`,
      type: 'info',
      relatedId: leadId,
      relatedType: 'lead'
    });

    res.json({
      success: true,
      message: 'Lead assignment notification sent successfully'
    });
  } catch (error) {
    console.error('Send lead assignment notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending lead assignment notification'
    });
  }
};

// Send task reminder
const sendTaskReminder = async (req, res) => {
  try {
    const { taskId } = req.params;

    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Get task owner
    const taskOwner = await authService.findUserById(task.user_id);
    if (!taskOwner) {
      return res.status(404).json({
        success: false,
        message: 'Task owner not found'
      });
    }

    // Send task reminder email
    await emailService.sendTaskReminder(taskOwner, task);

    res.json({
      success: true,
      message: 'Task reminder sent successfully'
    });
  } catch (error) {
    console.error('Send task reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending task reminder'
    });
  }
};

// Get user notifications
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (unreadOnly === 'true') {
      query = query.eq('is_read', false);
    }

    // Add pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: notifications, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: notifications.length
        }
      }
    });
  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
};

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read'
    });
  }
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read'
    });
  }
};

// Helper functions
const generateTemporaryPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const createNotificationRecord = async (notificationData) => {
  const { error } = await supabase
    .from('notifications')
    .insert(notificationData);

  if (error) {
    console.error('Error creating notification record:', error);
  }
};

module.exports = {
  sendAccountInvite,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendMeetingInvite,
  sendLeadAssignmentNotification,
  sendTaskReminder,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
}; 