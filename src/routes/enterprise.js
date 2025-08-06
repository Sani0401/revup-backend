const express = require('express');
const { body } = require('express-validator');
const enterpriseController = require('../controllers/enterpriseController');
const auth = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateEnterpriseCreation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Enterprise name must be between 2 and 200 characters'),
  body('domain')
    .optional()
    .isFQDN()
    .withMessage('Please provide a valid domain'),
  body('industry')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Industry must be less than 100 characters'),
  body('company_size')
    .optional()
    .isIn(['1-10', '11-50', '51-200', '201-1000', '1000+'])
    .withMessage('Invalid company size'),
  body('subscription_plan')
    .optional()
    .isIn(['basic', 'pro', 'enterprise'])
    .withMessage('Invalid subscription plan')
];

// Routes
router.post('/create', validateEnterpriseCreation, enterpriseController.createEnterprise);
router.get('/:id', auth, enterpriseController.getEnterprise);
router.put('/:id', auth, validateEnterpriseCreation, enterpriseController.updateEnterprise);
router.get('/:id/config', auth, enterpriseController.getEnterpriseConfig);  // Need to check if this is needed
router.put('/:id/config', auth, enterpriseController.updateEnterpriseConfig); // Need to check if this is needed
// Lead fields
router.put('/:id/lead-fields', auth, enterpriseController.storeLeadFields);
router.get('/:id/lead-fields', auth, enterpriseController.getLeadFields);
router.post('/:id/lead-fields/refresh', auth, enterpriseController.refreshLeadFieldsFromHubspot);
router.get('/:id/lead-fields/selected', auth, enterpriseController.getSelectedLeadFields);

// Qualification rules
router.put('/:id/lead-qualification-rules', auth, enterpriseController.storeQualificationRules);
router.get('/:id/lead-qualification-rules', auth, enterpriseController.getQualificationRules);

// Team management routes
router.get('/:enterpriseId/users', enterpriseController.getEnterpriseUsers);
router.get('/:enterpriseId/users/:userId', enterpriseController.getEnterpriseUserById);

module.exports = router; 