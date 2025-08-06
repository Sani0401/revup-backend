const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const supabase = require('../config/supabase');
const axios = require('axios');

// Create new enterprise
const createEnterprise = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const enterpriseData = {
      name: req.body.name,
      domain: req.body.domain,
      industry: req.body.industry,
      company_size: req.body.company_size,
      subscription_plan: req.body.subscription_plan || 'basic',
      subscription_status: 'active',
      is_active: true
    };

    // Create enterprise
    const enterprise = await authService.createEnterprise(enterpriseData);

    // Create default roles for the enterprise
    await createDefaultRoles(enterprise.id);

    res.status(201).json({
      success: true,
      message: 'Enterprise created successfully',
      data: {
        enterprise
      }
    });
  } catch (error) {
    console.error('Enterprise creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating enterprise'
    });
  }
};

// Get enterprise details
const getEnterprise = async (req, res) => {
  try {
    const { id } = req.params;
    const enterprise = await authService.findEnterpriseById(id);

    if (!enterprise) {
      return res.status(404).json({
        success: false,
        message: 'Enterprise not found'
      });
    }

    res.json({
      success: true,
      data: {
        enterprise
      }
    });
  } catch (error) {
    console.error('Get enterprise error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enterprise'
    });
  }
};

// Update enterprise
const updateEnterprise = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = {
      name: req.body.name,
      domain: req.body.domain,
      industry: req.body.industry,
      company_size: req.body.company_size,
      subscription_plan: req.body.subscription_plan
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    const { data: enterprise, error } = await supabase
      .from('enterprises')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !enterprise) {
      return res.status(404).json({
        success: false,
        message: 'Enterprise not found'
      });
    }

    res.json({
      success: true,
      message: 'Enterprise updated successfully',
      data: {
        enterprise
      }
    });
  } catch (error) {
    console.error('Update enterprise error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating enterprise'
    });
  }
};

// Get enterprise configuration
const getEnterpriseConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { configType } = req.query;

    let query = supabase
      .from('enterprise_configs')
      .select('*')
      .eq('enterprise_id', id)
      .eq('is_active', true);

    if (configType) {
      query = query.eq('config_type', configType);
    }

    const { data: configs, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        configs
      }
    });
  } catch (error) {
    console.error('Get enterprise config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enterprise configuration'
    });
  }
};

// Update enterprise configuration
const updateEnterpriseConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const { configType, configData } = req.body;

    if (!configType || !configData) {
      return res.status(400).json({
        success: false,
        message: 'Config type and config data are required'
      });
    }

    const { data: config, error } = await supabase
      .from('enterprise_configs')
      .upsert({
        enterprise_id: id,
        config_type: configType,
        config_data: configData,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Enterprise configuration updated successfully',
      data: {
        config
      }
    });
  } catch (error) {
    console.error('Update enterprise config error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating enterprise configuration'
    });
  }
};

// Helper function to create default roles
const createDefaultRoles = async (enterpriseId) => {
  const defaultRoles = [
    {
      enterprise_id: enterpriseId,
      name: 'AE',
      description: 'Account Executive',
      is_system_role: false
    },
    {
      enterprise_id: enterpriseId,
      name: 'SDR',
      description: 'Sales Development Representative',
      is_system_role: false
    },
    {
      enterprise_id: enterpriseId,
      name: 'MANAGER',
      description: 'Admin',
      is_system_role: true
    }
  ];

  for (const role of defaultRoles) {
    await supabase
      .from('roles')
      .insert(role);
  }
};

// Get all users of an enterprise with roles and details
const getEnterpriseUsers = async (req, res) => {
  try {
    const { enterpriseId } = req.params;
    const { page = 1, limit = 20, search, role, status } = req.query;

    // Validate enterprise ID
    if (!enterpriseId) {
      return res.status(400).json({
        success: false,
        message: 'Enterprise ID is required'
      });
    }

    // Check if enterprise exists
    const enterprise = await authService.findEnterpriseById(enterpriseId);
    if (!enterprise) {
      return res.status(404).json({
        success: false,
        message: 'Enterprise not found'
      });
    }

    // Build query
    let query = supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        avatar_url,
        phone,
        timezone,
        is_active,
        email_verified,
        last_login,
        created_at,
        updated_at,
        roles:role_id (
          id,
          name,
          description,
          is_system_role
        )
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true);

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (role) {
      query = query.eq('roles.name', role);
    }

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true);

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data: users, error } = await query;

    if (error) {
      console.error('Error fetching enterprise users:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching users'
      });
    }

    // Transform data for frontend
    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar_url,
      phone: user.phone,
      timezone: user.timezone,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      role: {
        id: user.roles?.id,
        name: user.roles?.name,
        description: user.roles?.description,
        isSystemRole: user.roles?.is_system_role
      }
    }));

    // Get role statistics
    const roleStats = await supabase
      .from('users')
      .select(`
        roles:role_id (
          name
        )
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true);

    const roleCounts = {};
    if (roleStats.data) {
      roleStats.data.forEach(user => {
        const roleName = user.roles?.name || 'Unknown';
        roleCounts[roleName] = (roleCounts[roleName] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        users: transformedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        statistics: {
          totalUsers: count || 0,
          activeUsers: transformedUsers.filter(u => u.isActive).length,
          roleDistribution: roleCounts
        },
        enterprise: {
          id: enterprise.id,
          name: enterprise.name,
          domain: enterprise.domain
        }
      }
    });

  } catch (error) {
    console.error('Get enterprise users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enterprise users'
    });
  }
};

// Get user details by ID within enterprise
const getEnterpriseUserById = async (req, res) => {
  try {
    const { enterpriseId, userId } = req.params;

    if (!enterpriseId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Enterprise ID and User ID are required'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        avatar_url,
        phone,
        timezone,
        is_active,
        email_verified,
        last_login,
        created_at,
        updated_at,
        roles:role_id (
          id,
          name,
          description,
          is_system_role
        )
      `)
      .eq('enterprise_id', enterpriseId)
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in this enterprise'
      });
    }

    // Transform data
    const transformedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar_url,
      phone: user.phone,
      timezone: user.timezone,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      role: {
        id: user.roles?.id,
        name: user.roles?.name,
        description: user.roles?.description,
        isSystemRole: user.roles?.is_system_role
      }
    };

    res.json({
      success: true,
      data: transformedUser
    });

  } catch (error) {
    console.error('Get enterprise user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user details'
    });
  }
};

// Store or update lead fields configuration for an enterprise
const storeLeadFields = async (req, res) => {
  try {
    const { id } = req.params;
    const { leadFields } = req.body;

    if (!leadFields || typeof leadFields !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'leadFields (object) is required in request body'
      });
    }

    const { data: config, error } = await supabase
      .from('enterprise_configs')
      .upsert({
        enterprise_id: id,
        config_type: 'lead_fields',
        config_data: leadFields,
        is_active: true
      }, { onConflict: 'enterprise_id,config_type' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'Lead fields saved successfully',
      data: { config }
    });
  } catch (error) {
    console.error('Store lead fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving lead fields'
    });
  }
};

// Store or update lead qualification rules for an enterprise
const storeQualificationRules = async (req, res) => {
  try {
    const { id } = req.params;
    const { rules } = req.body;

    if (!rules || typeof rules !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'rules (object) is required in request body'
      });
    }

    const { data: config, error } = await supabase
      .from('enterprise_configs')
      .upsert({
        enterprise_id: id,
        config_type: 'lead_qualification_rules',
        config_data: rules,
        is_active: true
      }, { onConflict: 'enterprise_id,config_type' })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: 'Qualification rules saved', data: { config } });
  } catch (error) {
    console.error('Store qualification rules error:', error);
    res.status(500).json({ success: false, message: 'Error saving qualification rules' });
  }
};

// Retrieve lead fields configuration for an enterprise
const getLeadFields = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: config, error } = await supabase
      .from('enterprise_configs')
      .select('config_data')
      .eq('enterprise_id', id)
      .eq('config_type', 'lead_fields')
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116' || error.code === '22P02') {
        return res.status(404).json({
          success: false,
          message: 'Lead fields configuration not found'
        });
      }
      throw error;
    }

    res.json({
      success: true,
      data: config?.config_data || {}
    });
  } catch (error) {
    console.error('Get lead fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching lead fields'
    });
  }
};

// Retrieve qualification rules configuration for an enterprise
const getQualificationRules = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: config, error } = await supabase
      .from('enterprise_configs')
      .select('config_data')
      .eq('enterprise_id', id)
      .eq('config_type', 'lead_qualification_rules')
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116' || error.code === '22P02') {
        return res.status(404).json({ success: false, message: 'Qualification rules not found' });
      }
      throw error;
    }

    res.json({ success: true, data: config?.config_data || {} });
  } catch (error) {
    console.error('Get qualification rules error:', error);
    res.status(500).json({ success: false, message: 'Error fetching qualification rules' });
  }
};

// Retrieve unselected lead fields configuration for an enterprise
const getSelectedLeadFields = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: config, error } = await supabase
      .from('enterprise_configs')
      .select('config_data')
      .eq('enterprise_id', id)
      .eq('config_type', 'lead_fields')
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116' || error.code === '22P02') {
        return res.status(404).json({
          success: false,
          message: 'Lead fields configuration not found'
        });
      }
      throw error;
    }

    const allFields = config?.config_data || {};
    const unselected = Object.fromEntries(
      Object.entries(allFields).filter(([key, value]) => value?.required)
    );

    res.json({ success: true, data: unselected });
  } catch (error) {
    console.error('Get unselected lead fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unselected lead fields'
    });
  }
};

// Refresh lead fields from HubSpot and update enterprise_configs
const refreshLeadFieldsFromHubspot = async (req, res) => {
  try {
    const { id } = req.params; // enterprise ID
    console.log('id', id);
    // 1. Fetch HubSpot credentials
    const { data: credential, error: credError } = await supabase
      .from('enterprise_crm_credentials')
      .select('credential_data')
      .eq('enterprise_id', id)
      .single();

    if (credError || !credential) {
      return res.status(400).json({
        success: false,
        message: 'HubSpot credentials not found for this enterprise',
        error: credError
      });
    }

    const accessToken = credential.credential_data?.accessToken;
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'HubSpot access token missing in credential_data',
        error: credError
      });
    }

    // 2. Retrieve existing lead_fields config (to preserve is_selected flags)
    const { data: existingConfig } = await supabase
      .from('enterprise_configs')
      .select('config_data')
      .eq('enterprise_id', id)
      .eq('config_type', 'lead_fields')
      .eq('is_active', true)
      .maybeSingle();

    const existingFields = existingConfig?.config_data || {};

    // 3. Call HubSpot API to get contact properties
    const hubspotResp = await axios.get(
      'https://api.hubapi.com/crm/v3/properties/contacts',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { archived: false }
      }
    );

    const newFieldsObj = {};
    hubspotResp.data.results.forEach(prop => {
      newFieldsObj[prop.name] = {
        label: prop.label || prop.name,
        type: prop.type,
        is_selected: existingFields[prop.name]?.is_selected || false
      };
    });

    // 4. Upsert lead_fields config with latest keys
    const { data: config, error } = await supabase
      .from('enterprise_configs')
      .upsert({
        enterprise_id: id,
        config_type: 'lead_fields',
        config_data: newFieldsObj,
        is_active: true
      }, { onConflict: 'enterprise_id,config_type' })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Lead fields refreshed from HubSpot',
      data: { config }
    });
  } catch (error) {
    console.error('Refresh lead fields error:', error.response?.data || error);
    res.status(500).json({ success: false, message: 'Error refreshing lead fields' });
  }
};

module.exports = {
  createEnterprise,
  getEnterprise,
  updateEnterprise,
  getEnterpriseConfig,
  updateEnterpriseConfig,
  getEnterpriseUsers,
  getEnterpriseUserById,
  storeLeadFields,
  getLeadFields,
  storeQualificationRules,
  getQualificationRules,
  getSelectedLeadFields,
  refreshLeadFieldsFromHubspot
}; 