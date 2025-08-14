const express = require('express');
const router = express.Router();
const themeController = require('../controller/themecontroller');
const { verifytoken, authorized } = require('../middleware/auth');
const bodyParser = require('body-parser');

// Apply middleware to parse form data
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// Theme form routes
router.get('/', verifytoken, authorized, themeController.themeopener);
router.get('/form', verifytoken, authorized, themeController.themeform);
router.post('/form', verifytoken, authorized, themeController.themeformSave);
router.get('/success', verifytoken, authorized, themeController.success);

// Student progress route
router.get('/progress', verifytoken, authorized, themeController.studentProgress);

// Theme marks routes
router.get('/marks', verifytoken, authorized, themeController.themeformMarks);
router.get('/marksdata', verifytoken, authorized, themeController.thememarksOfStudent);

// Theme admin/setup routes
router.get('/fillupform', verifytoken, authorized, themeController.themefillupform);
router.post('/fillupform', verifytoken, authorized, themeController.themefillupformsave);

module.exports = router;