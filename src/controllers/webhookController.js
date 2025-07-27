const verifyLead = async (req, res) => {
  try {
    // Log headers and body for now
    console.log('🔔 Lead Verification Webhook Received');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // TODO: add proper signature verification & lead processing

    return res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ success: false, message: 'Internal error' });
  }
};

module.exports = { verifyLead }; 