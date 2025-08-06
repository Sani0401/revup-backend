const supabase = require('../config/supabase');
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Helper function to get contact data from HubSpot webhook payload
const extractContactData = (webhookPayload) => {
  const contactData = {};
  
  if (webhookPayload.subscriptionType === 'contact.propertyChange') {
    // Handle property change webhook
    const properties = webhookPayload.properties || {};
    Object.keys(properties).forEach(key => {
      contactData[key] = properties[key];
    });
  } else if (webhookPayload.subscriptionType === 'contact.creation') {
    // Handle contact creation webhook
    const properties = webhookPayload.properties || {};
    Object.keys(properties).forEach(key => {
      contactData[key] = properties[key];
    });
  }

  return contactData;
};

// OpenAI-powered lead qualification
const qualifyLeadWithAI = async (rules, contactData) => {
  try {
    const systemPrompt = `You are a lead qualification expert. Evaluate if a contact qualifies based on the given rules.

Rules: ${JSON.stringify(rules, null, 2)}

Contact Data: ${JSON.stringify(contactData, null, 2)}

Analyze the contact data against the rules and respond with a JSON object containing:
- qualified: boolean (true if contact meets all rules, false otherwise)
- score: number (0-100, where 100 is fully qualified)
- reasoning: string (brief explanation of the qualification decision)
- failedRules: array (list of rules that the contact failed to meet)

Respond only with valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Cheapest model
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 500
    });

    const response = completion.choices[0].message.content;
    const result = JSON.parse(response);

    return {
      qualified: result.qualified || false,
      score: result.score || 0,
      reasoning: result.reasoning || 'No reasoning provided',
      failedRules: result.failedRules || []
    };

  } catch (error) {
    console.error('OpenAI qualification error:', error);
    // Fallback to simple rule evaluation if AI fails
    return {
      qualified: false,
      score: 0,
      reasoning: 'AI qualification failed, defaulting to disqualified',
      failedRules: ['AI processing error']
    };
  }
};

const verifyLead = async (req, res) => {
  try {
    console.log('🔔 AI-Powered Lead Qualification Webhook Received');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // HubSpot sends an array of events, we'll process the first one
    const webhookEvents = Array.isArray(req.body) ? req.body : [req.body];
    const webhookPayload = webhookEvents[0];
    
    if (!webhookPayload) {
      return res.status(400).json({
        success: false,
        message: 'No webhook payload found'
      });
    }

    // Extract enterprise ID from webhook payload or headers
    // For now, we'll use a default enterprise ID since HubSpot doesn't send it
    // You'll need to configure this in your HubSpot webhook settings or use a mapping
    const enterpriseId = webhookPayload.enterpriseId || 
                        req.headers['x-enterprise-id'] || 
                        '83270fd0-a9aa-4793-8d64-c65597987ee1'; // Default enterprise ID
    
    if (!enterpriseId) {
      console.error('No enterprise ID found in webhook payload');
      return res.status(400).json({ 
        success: false, 
        message: 'Enterprise ID not found in webhook payload' 
      });
    }

    // Get qualification rules for this enterprise
    const { data: config, error: configError } = await supabase
      .from('enterprise_configs')
      .select('config_data')
      .eq('enterprise_id', enterpriseId)
      .eq('config_type', 'lead_qualification_rules')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.log('No qualification rules found for enterprise:', enterpriseId);
      // If no rules are set, consider the lead qualified
      return res.status(200).json({
        success: true,
        qualified: true,
        score: 100,
        reasoning: 'No qualification rules found - lead considered qualified',
        message: 'No qualification rules found - lead considered qualified'
      });
    }

    const rules = config.config_data;
    // For HubSpot contact creation events, we need to fetch the contact data
    // since the webhook payload doesn't include the properties
    let contactData = {};
    
    if (webhookPayload.subscriptionType === 'contact.creation') {
      // Get HubSpot credentials for this enterprise
      const { data: credential, error: credError } = await supabase
        .from('enterprise_crm_credentials')
        .select('credential_data')
        .eq('enterprise_id', enterpriseId)
        .eq('provider', 'hubspot')
        .eq('is_active', true)
        .single();

      if (credError || !credential) {
        console.error('HubSpot credentials not found for enterprise:', enterpriseId);
        return res.status(400).json({
          success: false,
          message: 'HubSpot credentials not found for this enterprise'
        });
      }

      const accessToken = credential.credential_data?.accessToken;
      if (!accessToken) {
        console.error('HubSpot access token missing in credentials');
        return res.status(400).json({
          success: false,
          message: 'HubSpot access token missing in credentials'
        });
      }

      // Fetch contact data from HubSpot API
      try {
        const hubspotResponse = await axios.get(
          `https://api.hubapi.com/crm/v3/objects/contacts/${webhookPayload.objectId}`,
          {
            headers: { 
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        contactData = hubspotResponse.data.properties || {};
        console.log('Fetched contact data from HubSpot:', contactData);
      } catch (hubspotError) {
        console.error('Error fetching contact from HubSpot:', hubspotError.response?.data || hubspotError);
        return res.status(500).json({
          success: false,
          message: 'Error fetching contact data from HubSpot'
        });
      }
    } else {
      contactData = extractContactData(webhookPayload);
    }
    
    console.log('Contact data extracted:', contactData);
    console.log('Rules to evaluate:', rules);

    // Use OpenAI to evaluate the lead against qualification rules
    const result = await qualifyLeadWithAI(rules, contactData);
    
    console.log('AI Qualification result:', result);

    // Store the qualification result (optional)
    const qualificationRecord = {
      enterprise_id: enterpriseId,
      contact_id: webhookPayload.objectId || webhookPayload.contactId,
      contact_data: contactData,
      rules_evaluated: rules,
      qualification_result: result,
      webhook_payload: webhookPayload,
      created_at: new Date().toISOString()
    };

    // You might want to store this in a separate table for analytics
    // const { error: storeError } = await supabase
    //   .from('lead_qualifications')
    //   .insert(qualificationRecord);

    // if (storeError) {
    //   console.error('Error storing qualification record:', storeError);
    // }

    return res.status(200).json({
      success: true,
      qualified: result.qualified,
      score: result.score,
      reasoning: result.reasoning,
      failedRules: result.failedRules,
      contactData,
      rulesEvaluated: rules,
      message: result.qualified ? 'Lead qualified' : 'Lead disqualified'
    });

  } catch (error) {
    console.error('AI lead qualification webhook error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error during lead qualification' 
    });
  }
};

module.exports = { verifyLead }; 