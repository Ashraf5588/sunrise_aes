/**
 * Simple autosave controller for theme evaluations
 * Provides a simplified endpoint for autosave operations
 */

const mongoose = require('mongoose');
const { ThemeEvaluation } = require('../model/themeformschema');

// Simplified autosave handler - less validation, just quick save
exports.simpleAutosave = async (req, res) => {
  try {
    // Get basic required fields
    const { roll, name, studentClass, section, subject, themeName } = req.body;
    
    // Validate minimal required fields
    if (!roll || !studentClass || !section || !subject || !themeName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields for autosave'
      });
    }
    
    // Check if record exists
    let record = await ThemeEvaluation.findOne({
      roll,
      studentClass,
      section
    });
    
    if (!record) {
      // Create new record with minimal data
      record = new ThemeEvaluation({
        roll,
        name: name || 'Unnamed',
        studentClass,
        section,
        subjects: [{
          name: subject,
          themes: [{
            themeName
          }]
        }]
      });
      
      await record.save();
      return res.json({
        success: true,
        message: 'Created new record for autosave',
        id: record._id
      });
    }
    
    // Find or create subject entry
    let subjectIndex = record.subjects.findIndex(s => s.name === subject);
    if (subjectIndex === -1) {
      record.subjects.push({
        name: subject,
        themes: []
      });
      subjectIndex = record.subjects.length - 1;
    }
    
    // Find or create theme entry
    let themeIndex = record.subjects[subjectIndex].themes.findIndex(t => t.themeName === themeName);
    if (themeIndex === -1) {
      record.subjects[subjectIndex].themes.push({
        themeName
      });
      themeIndex = record.subjects[subjectIndex].themes.length - 1;
    }
    
    // Get the existing theme data that we'll update
    const theme = record.subjects[subjectIndex].themes[themeIndex];
    
    // Store the update timestamp
    record.updatedAt = new Date();
    
    // Save the record
    await record.save();
    
    res.json({
      success: true,
      message: 'Autosave successful',
      id: record._id
    });
    
  } catch (error) {
    console.error('Simple autosave error:', error);
    res.status(500).json({
      success: false,
      message: 'Autosave error: ' + error.message
    });
  }
};
