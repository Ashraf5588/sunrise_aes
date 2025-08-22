/**
 * Theme Initialization Functions
 * This adds the new student record initialization functionality
 * to the existing theme controller
 */

const mongoose = require('mongoose');
const { studentSchema, studentrecordschema } = require("../model/adminschema");
const studentRecord = mongoose.model("studentRecord", studentrecordschema, "studentrecord");
const { ThemeEvaluationSchema } = require("../model/themeformschema");
const { themeSchemaFor1 } = require("../model/themeschema");

// Get theme format model by class
const getThemeFormat = (studentClass) => {
  // Collection name: themeFor{class}
  const collectionName = `themeFor${studentClass}`;
  console.log(`Getting theme format model for class ${studentClass} using collection ${collectionName}`);
  
  // Check if model already exists
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  
  // Create model with themeSchemaFor1 for configuration
  return mongoose.model(collectionName, themeSchemaFor1, collectionName);
};

// Get student theme data model by class
const getStudentThemeData = (studentClass) => {
  // Collection name: themeForStudent{class}
  const collectionName = `themeForStudent${studentClass}`;
  console.log(`Getting student theme data model for class ${studentClass} using collection ${collectionName}`);
  
  // Check if model already exists
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }
  
  // Create model with ThemeEvaluationSchema for student data
  return mongoose.model(collectionName, ThemeEvaluationSchema, collectionName);
};

/**
 * Initialize records for all students with default values
 * This creates empty records with zero marks for all students in a class/section
 */
exports.initializeStudentRecords = async (req, res) => {
  try {
    const { subject, studentClass, section } = req.query;
    
    if (!subject || !studentClass || !section) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: subject, studentClass, section"
      });
    }
    
    // Get all students in this class/section
    const students = await studentRecord.find({
      studentClass,
      section
    }).lean();
    
    if (students.length === 0) {
      return res.json({
        success: true,
        message: "No students found in this class/section",
        count: 0
      });
    }
    
    console.log(`Found ${students.length} students in class ${studentClass} ${section} for initialization`);
    
    // Get theme format to know what themes are available
    const themeFormatModel = getThemeFormat(studentClass);
    const themeFormats = await themeFormatModel.find({
      studentClass,
      subject
    }).lean();
    
    if (!themeFormats || themeFormats.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No theme format found for this class/subject"
      });
    }
    
    // Extract theme names
    const themeNames = [];
    themeFormats.forEach(format => {
      if (format.themes && format.themes.length > 0) {
        format.themes.forEach(theme => {
          if (theme.themeName && !themeNames.includes(theme.themeName)) {
            themeNames.push(theme.themeName);
          }
        });
      }
    });
    
    if (themeNames.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No themes found for this class/subject"
      });
    }
    
    console.log(`Found ${themeNames.length} themes for initialization`);
    
    // Get the data model for student records
    const ThemeModel = getStudentThemeData(studentClass);
    
    // Process each student
    let initializedCount = 0;
    let updatedCount = 0;
    
    for (const student of students) {
      // Check if student record already exists
      let studentRecord = await ThemeModel.findOne({
        roll: student.roll,
        studentClass,
        section
      });
      
      // If no record exists, create one with all themes
      if (!studentRecord) {
        studentRecord = new ThemeModel({
          roll: student.roll,
          name: student.name,
          studentClass,
          section,
          subjects: [{
            name: subject,
            themes: []
          }],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        initializedCount++;
      } else {
        // Check if this subject exists
        let subjectIndex = studentRecord.subjects.findIndex(subj => subj.name === subject);
        
        if (subjectIndex === -1) {
          // Add new subject
          studentRecord.subjects.push({
            name: subject,
            themes: []
          });
          subjectIndex = studentRecord.subjects.length - 1;
          updatedCount++;
        }
        
        // Get existing theme names for this subject
        const existingThemeNames = studentRecord.subjects[subjectIndex].themes.map(theme => theme.themeName);
        
        // For each theme that doesn't exist, add it with default values
        const themesToAdd = themeNames.filter(name => !existingThemeNames.includes(name));
        
        if (themesToAdd.length > 0) {
          updatedCount++;
          
          // Add each missing theme with default values
          for (const themeName of themesToAdd) {
            // Find theme format to get learning outcomes and indicators
            const themeFormat = themeFormats.find(format => 
              format.themes && format.themes.some(theme => theme.themeName === themeName)
            );
            
            if (!themeFormat) continue;
            
            // Get learning outcomes for this theme
            const themeData = themeFormat.themes.find(theme => theme.themeName === themeName);
            if (!themeData || !themeData.learningOutcome) continue;
            
            // Create default theme data with zeroes for all marks
            const newTheme = {
              themeName,
              learningOutcomes: themeData.learningOutcome.map(outcome => {
                return {
                  name: outcome.learningOutcomeName,
                  evaluationDate: new Date(),
                  indicators: outcome.indicators.map(indicator => {
                    return {
                      name: indicator.indicatorName,
                      maxMarks: indicator.indicatorsMarks || 10,
                      marksBeforeIntervention: 0,
                      marksAfterIntervention: 0,
                      toolsUsed: ''
                    };
                  }),
                  totalMarksBeforeIntervention: 0,
                  totalMarksAfterIntervention: 0
                };
              }),
              overallTotalBefore: 0,
              overallTotalAfter: 0
            };
            
            studentRecord.subjects[subjectIndex].themes.push(newTheme);
          }
        }
      }
      
      // Save the student record
      await studentRecord.save();
    }
    
    return res.json({
      success: true,
      message: `Initialized ${initializedCount} new student records and updated ${updatedCount} existing records`,
      newRecords: initializedCount,
      updatedRecords: updatedCount,
      totalStudents: students.length
    });
    
  } catch (error) {
    console.error("Error initializing student records:", error);
    return res.status(500).json({
      success: false,
      message: "Error initializing student records: " + error.message
    });
  }
};
