const express = require('express');
const router = express.Router();
const themeController = require('../controller/themecontroller');
const { verifytoken, authorized } = require('../middleware/auth');
const bodyParser = require('body-parser');

// Apply middleware to parse form data
router.use(bodyParser.json({limit: '50mb'}));
router.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Import simple autosave controller for fallback
const simpleAutosave = require('../controller/simpleAutosave');

// Simple autosave endpoint (less validation, more reliable)
router.post('/autosave', verifytoken, authorized, simpleAutosave.simpleAutosave);

// Theme form routes
router.get('/', verifytoken, authorized, themeController.themeopener);
router.get('/form', verifytoken, authorized, themeController.themeform);
router.post('/form', verifytoken, authorized, themeController.themeformSave);
router.get('/success', verifytoken, authorized, themeController.success);

// Student progress route
router.get('/progress', verifytoken, authorized, themeController.studentProgress);

// Previous theme data routes
router.get('/previous-data', verifytoken, authorized, themeController.getPreviousThemeData);
router.get('/student-themes', verifytoken, authorized, themeController.getStudentThemes);

// Theme marks routes
router.get('/marks', verifytoken, authorized, themeController.themeformMarks);
router.get('/marksdata', verifytoken, authorized, themeController.thememarksOfStudent);

// Theme admin/setup routes
router.get('/fillupform', verifytoken, authorized, themeController.themefillupform);
router.post('/fillupform', verifytoken, authorized, themeController.themefillupformsave);

module.exports = router;