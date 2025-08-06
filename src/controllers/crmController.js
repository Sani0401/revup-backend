const { validationResult } = require('express-validator');
const supabase = require('../config/supabase');

// Allowed CRM providers
const ALLOWED_PROVIDERS = ['hubspot', 'salesforce'];

/**
 * Upsert (create/update) CRM configuration for the authenticated user enterprise.
 * Expects:
 *  - provider (path param): hubspot | salesforce
 *  - configData (body): object with provider-specific keys
 *
 * Credentials are stored in the `enterprise_credentials` table with:
 *   enterprise_id = req.user.enterpriseId
 *   provider      = provider (hubspot | salesforce)
 *   credentials_data = configData (JSON)
 */
const upsertCRMConfig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { provider } = req.params;
    const { configData } = req.body;

    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: `Invalid provider. Allowed values: ${ALLOWED_PROVIDERS.join(', ')}`
      });
    }

    if (!configData || typeof configData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'configData (object) is required in request body'
      });
    }

    // Enterprise from authenticated user
    const enterpriseId = req.user?.enterpriseId;
    if (!enterpriseId) {
      return res.status(403).json({ success: false, message: 'Enterprise information not found in token.' });
    }

    const { data: credential, error } = await supabase
      .from('enterprise_crm_credentials')
      .upsert({
        enterprise_id: enterpriseId,
        provider,
        credential_data: configData,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: 'CRM credentials saved successfully',
      data: { credential }
    });
  } catch (error) {
    console.error('CRM config upsert error:', error);
    res.status(500).json({ success: false, message: 'Error saving CRM configuration' });
  }
};

/**
 * Fetch CRM configuration for a provider.
 */
const getCRMConfig = async (req, res) => {
  try {
    const { provider } = req.params;

    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: `Invalid provider. Allowed values: ${ALLOWED_PROVIDERS.join(', ')}`
      });
    }

    const enterpriseId = req.user?.enterpriseId;
    if (!enterpriseId) {
      return res.status(403).json({ success: false, message: 'Enterprise information not found in token.' });
    }

    const { data: credential, error } = await supabase
      .from('enterprise_crm_credentials')
      .select('*')
      .eq('enterprise_id', enterpriseId)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // row not found
        return res.status(404).json({ success: false, message: 'Configuration not found' });
      }
      throw error;
    }

    res.json({ success: true, data: { credential } });
  } catch (error) {
    console.error('CRM config fetch error:', error);
    res.status(500).json({ success: false, message: 'Error fetching CRM configuration' });
  }
};

module.exports = {
  upsertCRMConfig,
  getCRMConfig
}; 