const express = require('express');
const router = express.Router();

const webhookController = require('../controllers/webhookController');

// Webhook to verify lead – no auth, external systems will post here
router.post('/lead-verify', webhookController.verifyLead);

module.exports = router; 