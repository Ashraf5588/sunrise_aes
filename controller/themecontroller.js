const path = require("path");

const fs= require("fs");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const { rootDir } = require("../utils/path");
const { studentSchema } = require("../model/schema");
const { studentrecordschema } = require("../model/adminschema");
const { classSchema, subjectSchema,terminalSchema } = require("../model/adminschema");
const {newsubjectSchema } = require("../model/adminschema");
const { name } = require("ejs");
const subjectlist = mongoose.model("subjectlist", subjectSchema, "subjectlist");
const studentClass = mongoose.model("studentClass", classSchema, "classlist");
const studentRecord = mongoose.model("studentRecord", studentrecordschema, "studentrecord");
const newsubject = mongoose.model("newsubject", newsubjectSchema, "newsubject");
const bcrypt = require("bcrypt");
const terminal = mongoose.model("terminal", terminalSchema, "terminal");
const {ThemeEvaluationSchema, ThemeEvaluation} = require("../model/themeformschema");
// Use the already created model from the schema file
const themeForStudent1 = ThemeEvaluation;
const {themeSchemaFor1} = require("../model/themeschema")
const themeFor1 = mongoose.model("themeFor1", themeSchemaFor1, "themeFor1");
app.set("view engine", "ejs");
app.set("view", path.join(rootDir, "views"));
const getSidenavData = async (req) => {
  try {
    const subjects = await subjectlist.find({}).lean();
    const studentClassdata = await studentClass.find({}).lean();
    const terminals = await terminal.find({}).lean();
    
    let accessibleSubject = [];
    let accessibleClass = [];
      let newaccessibleSubjects = [];
    const newsubjectList = await newsubject.find({}).lean();
    
    // Check if req exists and has user property
    if (req && req.user) {
      const user = req.user;
      // Log user info for debugging
      if (user && user.role) {
        console.log('User role:', user.role);
        console.log('User allowed subjects:', user.allowedSubjects || []);
      } else {
        console.log('User object exists but missing role or allowedSubjects');
      }
      
      if (user.role === "ADMIN") {
        accessibleSubject = subjects;
        accessibleClass = studentClassdata;
        newaccessibleSubjects = newsubjectList;
      } else {
        // Filter subjects based on user's allowed subjects
        accessibleSubject = subjects.filter(subj =>
          user.allowedSubjects && user.allowedSubjects.some(allowed =>
            allowed.subject === subj.subject
          )
        );
        
        // Filter classes based on user's allowed classes/sections
        accessibleClass = studentClassdata.filter(classItem =>
          user.allowedSubjects && user.allowedSubjects.some(allowed =>
            allowed.studentClass === classItem.studentClass && 
            allowed.section === classItem.section
          )
        );
         newaccessibleSubjects = newsubjectList.filter(subj =>
  user.allowedSubjects.some(allowed =>
    allowed.subject === subj.newsubject
  )
);
        console.log('Filtered subjects:', accessibleSubject.length);
        console.log('Filtered classes:', accessibleClass.length);
      }
    } else {
      // If no user is found, return all data (default admin view)
      console.log('No user found in request, returning all data');
      accessibleSubject = subjects;
      accessibleClass = studentClassdata;
      newsubjectList = newaccessibleSubjects;
      
    }
    
    return {
      subjects: accessibleSubject,
      studentClassdata: accessibleClass,
      terminals,
      newsubjectList: newaccessibleSubjects

    };
  } catch (error) {
    console.error('Error fetching sidenav data:', error);
    return {
      subjects: [],
      studentClassdata: [],
      terminals: []
    };
  }
};
exports.themeopener = async (req, res) => {
  try{
    return res.render("theme/theme",{...await getSidenavData(req),editing: false});

  }catch(err){
    console.error("Error in theme controller:", err);
    res.status(500).send("Internal Server Error");
  }
  
};
exports.themeform = async (req, res) => {
  try{
    const {subject, studentClass,section} = req.query;
          const themeData = await themeFor1.find({studentClass:studentClass, subject:subject, });
          console.log("Theme data fetched successfully:", themeData);
    return res.render("theme/themeform", { themeData, subject, studentClass, section });
  }catch(err){
    console.error("Error in theme controller:", err);
    res.status(500).send("Internal Server Error");
  }
  
};

exports.themeformSave = async (req, res) => {
  try {
    console.log("Form data received:", req.body);
    
    // Check if req.body exists
    if (!req.body) {
      console.error("Request body is undefined");
      return res.status(400).json({
        success: false,
        message: "No form data received"
      });
    }
    
    // Helper function to get first value if array
    const getValue = (value) => {
      if (!value) return '';
      return Array.isArray(value) ? value[0] : value;
    };
    
    // Validate required fields
    let roll = getValue(req.body.roll);
    let name = getValue(req.body.name);
    let studentClass = getValue(req.body.studentClass);
    let section = getValue(req.body.section);
    let subject = req.body.subjects && req.body.subjects[0] ? 
                 getValue(req.body.subjects[0].name) : '';
    let themeName = req.body.subjects && 
                   req.body.subjects[0] && 
                   req.body.subjects[0].themes && 
                   req.body.subjects[0].themes[0] ? 
                   getValue(req.body.subjects[0].themes[0].themeName) : '';
    
    if (!roll || !name || !studentClass || !section || !subject || !themeName) {
      console.error("Missing required fields:", { roll, name, studentClass, section, subject, themeName });
      return res.status(400).json({
        success: false,
        message: "Missing required fields: roll, name, class, section, subject, or themeName"
      });
    }
    
    // Clean up the form data to handle arrays
    const processFormData = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      // Create a new object to store processed data
      const result = Array.isArray(obj) ? [] : {};
      
      // Process each key in the object
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        
        // If value is array with 1 element and not supposed to be an array field
        if (Array.isArray(value) && 
            !['subjects', 'themes', 'learningOutcomes', 'indicators'].includes(key)) {
          result[key] = value[0]; // Take the first value
        }
        // If it's an object or array, process recursively
        else if (value && typeof value === 'object') {
          result[key] = processFormData(value);
        }
        // Otherwise use the value as is
        else {
          result[key] = value;
        }
      });
      
      return result;
    };

    // Process the new theme data
    const newThemeData = processFormData(req.body.subjects[0].themes[0]);
    
    console.log("Processed new theme data:", JSON.stringify(newThemeData, null, 2));
    
    // First, check if student record exists for this student (same roll, class, section)
    const existingStudentRecord = await themeForStudent1.findOne({
      roll,
      studentClass,
      section
    });
    
    let result;
    
    if (existingStudentRecord) {
      console.log("Found existing student record");
      
      // Check if this subject already exists
      const subjectIndex = existingStudentRecord.subjects.findIndex(subj => subj.name === subject);
      
      if (subjectIndex !== -1) {
        // Subject exists, check if this theme already exists
        const themeIndex = existingStudentRecord.subjects[subjectIndex].themes.findIndex(
          theme => theme.themeName === themeName
        );
        
        if (themeIndex !== -1) {
          // Theme exists, update it
          existingStudentRecord.subjects[subjectIndex].themes[themeIndex] = newThemeData;
          console.log("Updated existing theme");
        } else {
          // Theme doesn't exist, add new theme to existing subject
          existingStudentRecord.subjects[subjectIndex].themes.push(newThemeData);
          console.log("Added new theme to existing subject");
        }
      } else {
        // Subject doesn't exist, add new subject with the theme
        existingStudentRecord.subjects.push({
          name: subject,
          themes: [newThemeData]
        });
        console.log("Added new subject with theme");
      }
      
      // Update the record
      existingStudentRecord.updatedAt = new Date();
      result = await existingStudentRecord.save();
      
    } else {
      // No existing record, create new one
      const formData = {
        roll: roll,
        name: name,
        studentClass: studentClass,
        section: section,
        subjects: [{
          name: subject,
          themes: [newThemeData]
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log("Creating new student record:", JSON.stringify(formData, null, 2));
      result = await themeForStudent1.create(formData);
      console.log("New theme form data saved successfully");
    }
    
    // Handle response based on request type
    if (req.headers.accept && req.headers.accept.includes('application/json') || req.body.autosave === 'true' || req.body.ajax === 'true') {
      // If it's an AJAX request, autosave, or explicitly requested JSON response
      res.json({ 
        success: true, 
        id: result._id, 
        message: 'Data saved successfully',
        isAutosave: req.body.autosave === 'true',
        redirect: `/themeform?subject=${subject}&studentClass=${studentClass}` 
      });
    } else {
      // If it's a regular form submission, redirect
      res.redirect(`/themeform?subject=${subject}&studentClass=${studentClass}`);
    }
  } catch (err) {
    console.error("Error saving theme form data:", err);
    res.status(500).send("Error saving theme form: " + err.message);
  }
}

  

exports.themefillupform = async (req, res) => {
  try
  {
    return res.render("theme/themefiller");
  }catch(err){
    console.error("Error in theme controller:", err);
    res.status(500).send("Internal Server Error");

  }
}
exports.themefillupformsave = async (req, res) => {
  try
  {
    await themeFor1.create(req.body);
    console.log("Theme filled successfully");
    res.status(201).send("Theme filled successfully");
  }catch(err){
    console.error("Error in theme controller:", err);
    res.status(500).send("Internal Server Error");
  }
}

// Success page after form submission
exports.success = async (req, res) => {
  const formId = req.query.id;
  
  try {
    // If we have a form ID, get the form data to display context
    let formData = {};
    if (formId) {
      const themeForm = await themeForStudent1.findById(formId);
      if (themeForm) {
        // Get the most recently added theme (last one in the array)
        let latestSubject = '';
        let latestTheme = '';
        
        if (themeForm.subjects && themeForm.subjects.length > 0) {
          const lastSubject = themeForm.subjects[themeForm.subjects.length - 1];
          latestSubject = lastSubject.name;
          
          if (lastSubject.themes && lastSubject.themes.length > 0) {
            const lastTheme = lastSubject.themes[lastSubject.themes.length - 1];
            latestTheme = lastTheme.themeName;
          }
        }
        
        formData = {
          studentClass: themeForm.studentClass || '',
          section: themeForm.section || '',
          subject: latestSubject,
          roll: themeForm.roll || '',
          name: themeForm.name || '',
          themeName: latestTheme,
          totalSubjects: themeForm.subjects ? themeForm.subjects.length : 0,
          totalThemes: themeForm.subjects ? themeForm.subjects.reduce((total, subj) => total + (subj.themes ? subj.themes.length : 0), 0) : 0
        };
      }
    }
    
    res.render('theme/success', { 
      formId,
      ...formData
    });
  } catch (error) {
    console.error('Error rendering success page:', error);
    res.render('theme/success', { 
      formId,
      error: error.message 
    });
  }
}

// Function to view theme marks report
exports.themeMarks = async (req, res) => {
  try {
    const { studentClass, section, subject } = req.query;
    
    // Build query based on provided filters
    let query = {};
    if (studentClass) query.studentClass = studentClass;
    if (section) query.section = section;
    
    // If subject is specified, filter by subject in aggregation
    let pipeline = [
      { $match: query }
    ];
    
    if (subject) {
      pipeline.push({
        $addFields: {
          subjects: {
            $filter: {
              input: "$subjects",
              cond: { $eq: ["$$this.name", subject] }
            }
          }
        }
      });
    }
    
    // Get theme evaluation data
    const themeData = await themeForStudent1.aggregate(pipeline);
    
    console.log("Theme marks data fetched:", themeData.length, "records");
    
    // Get filter options for the form
    const filterOptions = await getSidenavData(req);
    
    res.render('theme/thememarks', { 
      themeData,
      selectedClass: studentClass || '',
      selectedSection: section || '',
      selectedSubject: subject || '',
      ...filterOptions
    });
  } catch (error) {
    console.error('Error fetching theme marks:', error);
    res.status(500).send('Error fetching theme marks: ' + error.message);
  }
}

// Function to get student progress data
exports.studentProgress = async (req, res) => {
  try {
    const { roll, studentClass, section } = req.query;
    
    if (!roll || !studentClass || !section) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: roll, studentClass, section'
      });
    }
    
    const studentRecord = await themeForStudent1.findOne({
      roll,
      studentClass,
      section
    });
    
    if (!studentRecord) {
      return res.json({
        success: true,
        message: 'No theme records found for this student',
        data: null
      });
    }
    
    // Format the data for easy viewing
    const progressData = {
      student: {
        name: studentRecord.name,
        roll: studentRecord.roll,
        class: studentRecord.studentClass,
        section: studentRecord.section
      },
      subjects: studentRecord.subjects.map(subject => ({
        name: subject.name,
        totalThemes: subject.themes.length,
        themes: subject.themes.map(theme => ({
          name: theme.themeName,
          totalLearningOutcomes: theme.learningOutcomes.length,
          overallProgress: {
            before: theme.overallTotalBefore,
            after: theme.overallTotalAfter
          }
        }))
      })),
      summary: {
        totalSubjects: studentRecord.subjects.length,
        totalThemes: studentRecord.subjects.reduce((total, subj) => total + subj.themes.length, 0),
        lastUpdated: studentRecord.updatedAt
      }
    };
    
    res.json({
      success: true,
      data: progressData
    });
    
  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student progress',
      error: error.message
    });
  }
}

exports.themeformMarks = async (req, res) => {
  try {

    return res.render("theme/thememarkschoose",{...await getSidenavData(req),editing: false});
  }catch (error) {
    console.error('Error fetching theme for marks:', error);
    res.render('theme/success', {
      error: error.message
    });

  }
}  
exports.thememarksOfStudent = async (req, res) => {
  try {
    const { subject, studentClass, section } = req.query;
    
    // Build query based on provided filters
    let query = {};
    if (studentClass) query.studentClass = studentClass;
    if (section) query.section = section;
    
    const themeData = await themeForStudent1.find(query).lean();
    
    console.log("Theme data fetched successfully for marks:", themeData.length, "records");

    // Get sidenav data
    const sidenavData = await getSidenavData(req);

    return res.render("theme/thememarks", {
      ...sidenavData,
      editing: false, 
      subject: subject || '', 
      studentClass: studentClass || '', 
      section: section || '', 
      selectedClass: studentClass || '',
      selectedSection: section || '',
      selectedSubject: subject || '',
      themeData 
    });
  } catch (error) {
    console.error('Error fetching theme for marks:', error);
    res.render('theme/success', {
      error: error.message
    });
  }
}
exports.themewisemarks = async (req, res) => {
  try {
    const { studentClass, section, subject } = req.query;
    const themewisemarks = await themeForStudent1.find({
      studentClass: studentClass,
      section: section,
      
    }).lean();
    return res.render("theme/themewisemarks", {
      ...await getSidenavData(req),
      editing: false,
      studentClass,
      section,
      subject,
      themewisemarks,
    });
  } catch (error) {
    console.error('Error fetching theme wise marks:', error); 
    res.status(500).send('Error fetching theme wise marks: ' + error.message);
  }
}
exports.themeslip =  async (req, res) => {
  try {
    const { studentClass, section, subject } = req.query;
    const themeslip = await themeForStudent1.find({
      studentClass: studentClass,
      section: section,
      
    }).lean();
    return res.render("theme/themeslip", {
      ...await getSidenavData(req),
      editing: false,
      studentClass,
      section,
      subject,
      themeslip,
    });
  } catch (error) {
    console.error('Error fetching theme slip:', error);
    res.status(500).send('Error fetching theme slip: ' + error.message);
  }
}

// Function to get previous theme data for a student by roll number
exports.getPreviousThemeData = async (req, res) => {
  try {
    const { roll, subject, themeName, studentClass, section } = req.query;
    
    if (!roll || !subject || !themeName || !studentClass || !section) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: roll, subject, themeName, studentClass, section'
      });
    }
    
    // Find the student record
    const studentRecord = await themeForStudent1.findOne({
      roll,
      studentClass,
      section
    }).lean();
    
    if (!studentRecord) {
      return res.json({
        success: true,
        found: false,
        message: 'No records found for this student'
      });
    }
    
    // Look for the specific subject and theme
    let themeData = null;
    let subjectData = null;
    
    // Find the subject
    for (const subj of studentRecord.subjects) {
      if (subj.name === subject) {
        subjectData = subj;
        
        // Find the theme
        for (const theme of subj.themes) {
          if (theme.themeName === themeName) {
            themeData = theme;
            break;
          }
        }
        
        break;
      }
    }
    
    if (!themeData) {
      return res.json({
        success: true,
        found: false,
        message: 'No data found for this theme',
        studentName: studentRecord.name // Return the student name at least
      });
    }
    
    return res.json({
      success: true,
      found: true,
      studentName: studentRecord.name,
      themeData
    });
    
  } catch (error) {
    console.error('Error fetching previous theme data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching previous theme data: ' + error.message
    });
  }
}

// Function to get all themes for a student (to show available options)
exports.getStudentThemes = async (req, res) => {
  try {
    const { roll, studentClass, section } = req.query;
    
    if (!roll || !studentClass || !section) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: roll, studentClass, section'
      });
    }
    
    // Find the student record
    const studentRecord = await themeForStudent1.findOne({
      roll,
      studentClass,
      section
    }).lean();
    
    if (!studentRecord) {
      return res.json({
        success: true,
        found: false,
        message: 'No theme data found for this student',
        themes: []
      });
    }
    
    // Extract all themes for this student across subjects
    const allThemes = [];
    
    // Process each subject
    studentRecord.subjects.forEach(subject => {
      if (subject.themes && subject.themes.length > 0) {
        // For each theme in this subject
        subject.themes.forEach(theme => {
          // Add to our theme list
          allThemes.push({
            subject: subject.name,
            name: theme.themeName,
            count: 1,  // Count one evaluation
            updatedAt: theme.updatedAt || studentRecord.updatedAt
          });
        });
      }
    });
    
    // Group themes by name to count multiple evaluations of the same theme
    const groupedThemes = allThemes.reduce((acc, theme) => {
      const existingTheme = acc.find(t => t.name === theme.name);
      if (existingTheme) {
        existingTheme.count += 1;
        // Keep the most recent updated date
        if (theme.updatedAt && (!existingTheme.updatedAt || new Date(theme.updatedAt) > new Date(existingTheme.updatedAt))) {
          existingTheme.updatedAt = theme.updatedAt;
        }
      } else {
        acc.push(theme);
      }
      return acc;
    }, []);
    
    // Sort by most recently updated
    groupedThemes.sort((a, b) => {
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    
    return res.json({
      success: true,
      found: groupedThemes.length > 0,
      studentName: studentRecord.name,
      themes: groupedThemes
    });
    
  } catch (error) {
    console.error('Error fetching student themes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching student themes: ' + error.message
    });
  }
}