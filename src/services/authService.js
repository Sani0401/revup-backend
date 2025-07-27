const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../config/supabase');

class AuthService {
  // User management
  async createUser(userData) {
    const { name, email, password, enterpriseId, roleId } = userData;

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Use the provided roleId or get default AE role
    let finalRoleId = roleId;
    
    if (!finalRoleId) {
      // Get default role for the enterprise (AE role)
      const { data: defaultRole, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('enterprise_id', enterpriseId)
        .eq('name', 'AE')
        .single();

      if (roleError || !defaultRole) {
        throw new Error('Default role not found for enterprise');
      }
      finalRoleId = defaultRole.id;
    }

    // Create user object
    const user = {
      enterprise_id: enterpriseId,
      name,
      email: email.toLowerCase(),
      password_hash: hashedPassword,
      role_id: finalRoleId,
      is_active: true,
      email_verified: false
    };

    const { data: newUser, error } = await supabase
      .from('users')
      .insert(user)
      .select(`
        *,
        roles:role_id (
          id,
          name,
          description
        ),
        enterprises:enterprise_id (
          id,
          name,
          domain,
          subscription_plan,
          subscription_status
        )
      `)
      .single();

    if (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }

    // Return user without password
    const { password_hash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  async findUserByEmail(email) {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        roles:role_id (
          id,
          name,
          description
        ),
        enterprises:enterprise_id (
          id,
          name,
          domain,
          subscription_plan,
          subscription_status
        )
      `)
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return null;
    }

    return user;
  }

  async findUserById(id) {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        roles:role_id (
          id,
          name,
          description
        ),
        enterprises:enterprise_id (
          id,
          name,
          domain,
          subscription_plan,
          subscription_status
        )
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return null;
    }

    // Return user without password
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUser(userId, updateData) {
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select(`
        *,
        roles:role_id (
          id,
          name,
          description
        ),
        enterprises:enterprise_id (
          id,
          name,
          domain,
          subscription_plan,
          subscription_status
        )
      `)
      .single();

    if (error || !updatedUser) {
      return null;
    }

    // Return user without password
    const { password_hash, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  async deleteUser(userId) {
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId);

    if (error) {
      return false;
    }

    // Remove associated refresh tokens
    await this.removeAllUserRefreshTokens(userId);
    
    return true;
  }

  // Password management
  async changePassword(userId, currentPassword, newPassword) {
    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) return false;

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) return false;

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashedNewPassword })
      .eq('id', userId);

    if (updateError) return false;

    return true;
  }

  generatePasswordResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async savePasswordResetToken(userId, token) {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in a separate table or use enterprise_configs
    const { error } = await supabase
      .from('enterprise_configs')
      .insert({
        enterprise_id: (await this.findUserById(userId)).enterprise_id,
        config_type: 'password_reset_tokens',
        config_data: {
          userId,
          token,
          expiresAt: expiresAt.toISOString()
        }
      });

    if (error) {
      throw new Error('Failed to save reset token');
    }
  }

  async resetPasswordWithToken(token, newPassword) {
    // Find reset token in enterprise_configs
    const { data: configs, error } = await supabase
      .from('enterprise_configs')
      .select('config_data')
      .eq('config_type', 'password_reset_tokens')
      .contains('config_data', { token });

    if (error || !configs || configs.length === 0) {
      return false;
    }

    const resetToken = configs[0].config_data;
    
    if (new Date(resetToken.expiresAt) < new Date()) {
      return false;
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('id', resetToken.userId);

    if (updateError) return false;

    // Remove used token
    await supabase
      .from('enterprise_configs')
      .delete()
      .eq('config_type', 'password_reset_tokens')
      .contains('config_data', { token });

    return true;
  }

  // Token management
  generateAccessToken(user) {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        enterpriseId: user.enterprise_id,
        role: user.roles?.name
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      { 
        userId: user.id,
        enterpriseId: user.enterprise_id,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
  }

  async saveRefreshToken(userId, token) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store refresh token in enterprise_configs
    const user = await this.findUserById(userId);
    const { error } = await supabase
      .from('enterprise_configs')
      .insert({
        enterprise_id: user.enterprise_id,
        config_type: 'refresh_tokens',
        config_data: {
          userId,
          token,
          expiresAt: expiresAt.toISOString()
        }
      });

    if (error) {
      throw new Error('Failed to save refresh token');
    }
  }

  async findRefreshToken(token) {
    // Find refresh token in enterprise_configs
    const { data: configs, error } = await supabase
      .from('enterprise_configs')
      .select('config_data')
      .eq('config_type', 'refresh_tokens')
      .contains('config_data', { token });

    if (error || !configs || configs.length === 0) {
      return null;
    }

    const refreshToken = configs[0].config_data;
    
    if (new Date(refreshToken.expiresAt) < new Date()) {
      return null;
    }

    return refreshToken;
  }

  async removeRefreshToken(token) {
    await supabase
      .from('enterprise_configs')
      .delete()
      .eq('config_type', 'refresh_tokens')
      .contains('config_data', { token });
  }

  async removeAllUserRefreshTokens(userId) {
    await supabase
      .from('enterprise_configs')
      .delete()
      .eq('config_type', 'refresh_tokens')
      .contains('config_data', { userId });
  }

  // Utility methods
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Clean up expired tokens (call this periodically in production)
  async cleanupExpiredTokens() {
    const now = new Date().toISOString();
    
    // Clean up expired refresh tokens
    await supabase
      .from('enterprise_configs')
      .delete()
      .eq('config_type', 'refresh_tokens')
      .lt('config_data->expiresAt', now);

    // Clean up expired password reset tokens
    await supabase
      .from('enterprise_configs')
      .delete()
      .eq('config_type', 'password_reset_tokens')
      .lt('config_data->expiresAt', now);
  }

  // Enterprise management methods
  async createEnterprise(enterpriseData) {
    const { data: enterprise, error } = await supabase
      .from('enterprises')
      .insert(enterpriseData)
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating enterprise: ${error.message}`);
    }

    return enterprise;
  }

  async findEnterpriseById(id) {
    const { data: enterprise, error } = await supabase
      .from('enterprises')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !enterprise) {
      return null;
    }

    return enterprise;
  }

  async findEnterpriseByDomain(domain) {
    const { data: enterprise, error } = await supabase
      .from('enterprises')
      .select('*')
      .eq('domain', domain)
      .eq('is_active', true)
      .single();

    if (error || !enterprise) {
      return null;
    }

    return enterprise;
  }
}

module.exports = new AuthService(); 