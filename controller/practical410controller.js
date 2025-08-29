const path = require("path");

const fs= require("fs");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const { rootDir } = require("../utils/path");
const { studentSchema, studentrecordschema } = require("../model/adminschema");
const { classSchema, subjectSchema,terminalSchema } = require("../model/adminschema");
const {newsubjectSchema } = require("../model/adminschema");
const { name } = require("ejs");
const subjectlist = mongoose.model("subjectlist", subjectSchema, "subjectlist");
const studentClass = mongoose.model("studentClass", classSchema, "classlist");
const studentRecord = mongoose.model("studentRecord", studentrecordschema, "studentrecord");
const newsubject = mongoose.model("newsubject", newsubjectSchema, "newsubject");
const bcrypt = require("bcrypt");
const terminal = mongoose.model("terminal", terminalSchema, "terminal");
const {ThemeEvaluationSchema,practicalSchema,scienceprojectSchema} = require("../model/themeformschema");
const {themeSchemaFor1,scienceSchema} = require("../model/themeschema")

// Create ScienceModel after importing scienceSchema
const ScienceModel = mongoose.model('sciencepractical', scienceSchema, 'sciencepracticals');
const scienceProjectModel = mongoose.model('scienceproject', scienceprojectSchema, 'scienceprojects');

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

const getThemeFormat = (studentClass) => {
  // Collection name: themeFor{class}
  const collectionName = `themeFor${studentClass}`;
  console.log(`Getting theme format model for class ${studentClass} using collection ${collectionName}`);
  
  // Check if model already exists
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }

  // Create model with practicalSchema for configuration
  return mongoose.model(collectionName, themeSchemaFor1, collectionName);
};
const getStudentThemeData = (studentClass) => {
  // Collection name: themeForStudent{class}
  const collectionName = `PracticalForStudent${studentClass}`;
  console.log(`Getting student theme data model for class ${studentClass} using collection ${collectionName}`);
  
  // Check if model already exists
  if (mongoose.models[collectionName]) {
    return mongoose.models[collectionName];
  }

  // Create model with practicalSchema for student data
  return mongoose.model(collectionName, practicalSchema, collectionName);
};

exports.chooseClass = async (req, res) => {
  
  res.render("theme/class", {...await getSidenavData(req),editing: false});
};
exports.evaluationForm = async (req, res) => {
  const {studentClass,section} = req.query;
  console.log(studentClass,section);
  if(studentClass==='1' || studentClass==='2' || studentClass==='3') {
    return res.render("theme/theme", {...await getSidenavData(req),editing: false, studentClass, section});
  } else {
     return res.render("theme/practicalform410pannel", {...await getSidenavData(req),editing: false, studentClass, section});
  }
};
exports.showpracticalDetailForm = async (req, res) => {
  const { studentClass, section, subject } = req.query;
  console.log(studentClass, section, subject);
  const practicalFormat = getThemeFormat(studentClass);
  const practicalFormatData = await practicalFormat.find({studentClass:studentClass,subject:subject}).lean();
  if(subject === "SCIENCE")
  {
    ScienceData = await ScienceModel.find({studentClass:studentClass,subject:subject}).lean();
     res.render("theme/practicaldetailform", {...await getSidenavData(req), editing: false, studentClass, section, subject, practicalFormatData, ScienceData});
  }
  else
  {
  res.render("theme/practicaldetailform", {...await getSidenavData(req), editing: false, studentClass, section, subject, practicalFormatData});
  }
  
};
exports.savepracticalDetailForm = async (req, res) => { 

   try {
    const { roll, name, studentClass, section, terminal } = req.body;
    const Practical = getStudentThemeData(studentClass);

    // Validate required fields
    if (!roll || !name || !studentClass || !section) {
      return res.status(400).json({ error: 'Roll, name, studentClass, and section are required' });
    }

    // Ensure terminal is an array
    const terminalData = Array.isArray(terminal) ? terminal : [terminal];

    // Find existing document for this roll, class, and section
    let existingPractical = await Practical.findOne({
      roll: roll,
      studentClass: studentClass,
      section: section
    });

    if (existingPractical) {
      // Update existing document - process all terminals
      for (const terminalItem of terminalData) {
        const terminalName = terminalItem.terminalName;

        // Find if this terminal already exists
        const terminalIndex = existingPractical.terminal.findIndex(
          t => t.terminalName === terminalName
        );

        if (terminalIndex !== -1) {
          // Terminal exists, process all subjects in this terminal
          const subjectData = Array.isArray(terminalItem.subject) ? terminalItem.subject : [terminalItem.subject];
          
          for (const subjectItem of subjectData) {
            const subjectName = subjectItem.subjectName;
            
            // Find if subject exists in this terminal
            const subjectIndex = existingPractical.terminal[terminalIndex].subject.findIndex(
              s => s.subjectName === subjectName
            );

            if (subjectIndex !== -1) {
              // Subject exists, update it
              existingPractical.terminal[terminalIndex].subject[subjectIndex] = {
                ...existingPractical.terminal[terminalIndex].subject[subjectIndex],
                ...subjectItem
              };
            } else {
              // Subject doesn't exist, add it
              existingPractical.terminal[terminalIndex].subject.push(subjectItem);
            }
          }

          // Update terminal-level data (attendance, etc.)
          existingPractical.terminal[terminalIndex].totalAttendance = terminalItem.totalAttendance;
          existingPractical.terminal[terminalIndex].attendanceMarks = terminalItem.attendanceMarks;

        } else {
          // Terminal doesn't exist, add new terminal
          existingPractical.terminal.push(terminalItem);
        }
      }

      // Save the updated document
      await existingPractical.save();

      res.status(200).json({
        message: 'Practical data updated successfully',
        data: existingPractical
      });

    } else {
      // Create new document
      const newPractical = new Practical({
        roll,
        name,
        studentClass,
        section,
        terminal: terminalData
      });

      await newPractical.save();

      res.status(201).json({
        message: 'Practical data created successfully',
        data: newPractical
      });
    }

  } catch (error) {
    console.error('Error saving practical data:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};


exports.showpracticalSlip = async (req,res,next)=>{
try
{
  const { studentClass, section, subject } = req.query;
  console.log(studentClass, section, subject);

  const practicalDetail = getStudentThemeData(studentClass);
  const practicalDetailData = await practicalDetail.find().lean();

  res.render("theme/practicalslip", {...await getSidenavData(req), editing: false, studentClass, section, subject, practicalDetailData});
}catch(err)
{

}



}
exports.saveSciencePractical = async (req, res, next) => {
  try {
    console.log('Raw form data received:', JSON.stringify(req.body, null, 2));
    
    // Process and clean the form data
    let { studentClass, section, subject, academicYear, units } = req.body;
    
    // Transform units data to handle different input formats
    if (units && Array.isArray(units)) {
      units = units.map(unit => {
        const processedUnit = {
          unitName: unit.unitName,
          practicals: unit.practicals || [],
          projectworks: unit.projectworks || []
        };
        
        // Ensure practicals and projectworks are always arrays
        if (!Array.isArray(processedUnit.practicals)) {
          processedUnit.practicals = [];
        }
        if (!Array.isArray(processedUnit.projectworks)) {
          processedUnit.projectworks = [];
        }
        
        // Handle legacy format where projectWork might be an object with title/description
        if (unit.projectWork && typeof unit.projectWork === 'object') {
          Object.values(unit.projectWork).forEach(project => {
            if (typeof project === 'object' && project.title) {
              processedUnit.projectworks.push(project.title);
            } else if (typeof project === 'string') {
              processedUnit.projectworks.push(project);
            }
          });
        }
        
        return processedUnit;
      });
    } else {
      units = [];
    }
    
    console.log('Received science practical data:', {
      studentClass,
      section,
      subject,
      academicYear,
      units: units ? units.length : 0,
      unitsDetail: units ? units.map((unit, index) => ({
        unitIndex: index,
        unitName: unit.unitName,
        practicals: unit.practicals ? unit.practicals.length : 0,
        projectworks: unit.projectworks ? unit.projectworks.length : 0,
        practicalsData: unit.practicals,
        projectworksData: unit.projectworks
      })) : []
    });

    // Validate required fields
    if (!studentClass || !subject || !academicYear) {
      return res.status(400).json({ 
        error: 'Student class, subject, and academic year are required' 
      });
    }

    if (!units || !Array.isArray(units) || units.length === 0) {
      return res.status(400).json({ 
        error: 'At least one unit with practicals or project works is required' 
      });
    }

    // Validate units, practicals, and project works
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (!unit.unitName || !unit.unitName.trim()) {
        return res.status(400).json({ 
          error: `Unit ${i + 1} name is required` 
        });
      }
      
      // Validate practicals - only if they exist
      if (unit.practicals && Array.isArray(unit.practicals) && unit.practicals.length > 0) {
        for (let j = 0; j < unit.practicals.length; j++) {
          if (!unit.practicals[j] || !unit.practicals[j].trim()) {
            return res.status(400).json({ 
              error: `Unit ${i + 1}, Practical ${j + 1} name is required` 
            });
          }
        }
      }

      // Validate project works - only if they exist
      if (unit.projectworks && Array.isArray(unit.projectworks) && unit.projectworks.length > 0) {
        for (let k = 0; k < unit.projectworks.length; k++) {
          if (!unit.projectworks[k] || !unit.projectworks[k].trim()) {
            return res.status(400).json({ 
              error: `Unit ${i + 1}, Project Work ${k + 1} name is required` 
            });
          }
        }
      }

      // Ensure at least one practical or project work exists
      const hasPracticals = unit.practicals && Array.isArray(unit.practicals) && unit.practicals.length > 0;
      const hasProjectWorks = unit.projectworks && Array.isArray(unit.projectworks) && unit.projectworks.length > 0;
      
      if (!hasPracticals && !hasProjectWorks) {
        return res.status(400).json({ 
          error: `Unit ${i + 1} must have at least one practical or project work` 
        });
      }
    }

    // Check if a configuration already exists for this class/subject/year
    const existingConfig = await ScienceModel.findOne({
      studentClass,
      subject,
      academicYear,
      ...(section && { section })
    });

    if (existingConfig) {
      // Update existing configuration
      existingConfig.units = units;
      existingConfig.updatedAt = new Date();
      
      await existingConfig.save();
      
      console.log('Updated existing science practical configuration');
      return res.status(200).json({
        success: true,
        message: 'Science practical configuration updated successfully',
        data: existingConfig
      });
    } else {
      // Create new configuration
      const newSciencePractical = new ScienceModel({
        studentClass,
        section: section || '',
        subject,
        academicYear,
        units,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newSciencePractical.save();
      
      console.log('Created new science practical configuration');
      return res.status(201).json({
        success: true,
        message: 'Science practical configuration saved successfully',
        data: newSciencePractical
      });
    }

  } catch (err) {
    console.error('Error saving science practical:', err);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  }
}
exports.saveScienceData = async (req,res,next)=>
{
  try
  {
    const { roll, name, studentClass, section, subject, academicYear, units } = req.body;

    // Validate required fields
    if (!roll || !name || !studentClass || !subject || !academicYear) {
      return res.status(400).json({ 
        error: 'Roll, name, studentClass, subject, and academic year are required' 
      });
    }

    // Transform units data to handle different input formats
    let processedUnits = [];
    if (units && Array.isArray(units)) {
      processedUnits = units.map(unit => {
        const processedUnit = {
          unitName: unit.unitName,
          practicals: unit.practicals || [],
          projectworks: unit.projectworks || []
        };
        
        // Ensure practicals and projectworks are always arrays
        if (!Array.isArray(processedUnit.practicals)) {
          processedUnit.practicals = [];
        }
        if (!Array.isArray(processedUnit.projectworks)) {
          processedUnit.projectworks = [];
        }
        
        return processedUnit;
      });
    }

    console.log('Received science student data:', {
      roll,
      name,
      studentClass,
      section,
      subject,
      academicYear,
      units: processedUnits.length,
      unitsDetail: processedUnits.map((unit, index) => ({
        unitIndex: index,
        unitName: unit.unitName,
        practicals: unit.practicals.length,
        projectworks: unit.projectworks.length,
        practicalsData: unit.practicals,
        projectworksData: unit.projectworks
      }))
    });

    // Check if a record already exists for this student/class/subject/year
    const existingRecord = await scienceProjectModel.findOne({
      roll,
      studentClass,
      section: section || '',
      subject,
      academicYear
    });

    if (existingRecord) {
      // Update existing record
      existingRecord.name = name; // Update name in case it changed
      existingRecord.units = processedUnits;
      existingRecord.updatedAt = new Date();
      
      await existingRecord.save();
      
      console.log('Updated existing science student record');
      return res.status(200).json({
        success: true,
        message: 'Science student record updated successfully',
        data: existingRecord
      });
    } else {
      // Create new record
      const newScienceStudentRecord = new scienceProjectModel({
        roll,
        name,
        studentClass,
        section,
        subject,
        academicYear,
        units: processedUnits,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newScienceStudentRecord.save();

      console.log('Created new science student record');
      return res.status(201).json({
        success: true,
        message: 'Science student record created successfully',
        data: newScienceStudentRecord
      });
    }
  } catch (err) {
    console.error('Error saving science practical data:', err);
    res.status(500).json({
      error: 'Internal server error',
      details: err.message
    });
  }
}