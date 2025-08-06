const express = require('express');
const { body } = require('express-validator');
const crmController = require('../controllers/crmController');
const auth = require('../middleware/auth');

const router = express.Router();

// Validation: ensure configData exists in body on upsert
const validateUpsert = [
  body('configData')
    .not()
    .isEmpty()
    .withMessage('configData is required')
    .custom(value => typeof value === 'object')
    .withMessage('configData must be an object')
];

// Upsert CRM config
router.put('/:provider', auth, validateUpsert, crmController.upsertCRMConfig);

// Get CRM config
router.get('/:provider', auth, crmController.getCRMConfig);

module.exports = router; 