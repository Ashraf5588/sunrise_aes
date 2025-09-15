const path = require("path");

const fs= require("fs");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const { rootDir } = require("../utils/path");
const { studentSchema, studentrecordschema } = require("../model/adminschema");
const { classSchema, subjectSchema,terminalSchema } = require("../model/adminschema");
const {newsubjectSchema,marksheetsetupSchema } = require("../model/adminschema");
const { name } = require("ejs");
const subjectlist = mongoose.model("subjectlist", subjectSchema, "subjectlist");
const studentClass = mongoose.model("studentClass", classSchema, "classlist");
const studentRecord = mongoose.model("studentRecord", studentrecordschema, "studentrecord");
const newsubject = mongoose.model("newsubject", newsubjectSchema, "newsubject");
const bcrypt = require("bcrypt");
const terminal = mongoose.model("terminal", terminalSchema, "terminal");
const {ThemeEvaluationSchema,practicalSchema,scienceprojectSchema, practicalprojectSchema} = require("../model/themeformschema");
const {themeSchemaFor1,scienceSchema,FinalPracticalSlipSchema} = require("../model/themeschema");
const { get } = require("http");
 const marksheetSetup = new mongoose.model("MarksheetSetup", marksheetsetupSchema,"marksheetSetting");




// Create ScienceModel after importing scienceSchema
const ScienceModel = mongoose.model('sciencepractical', scienceSchema, 'sciencepracticals');
const scienceProjectModel = mongoose.model('scienceproject', scienceprojectSchema, 'scienceprojects');







const getSubjectSlipModelForPractical = (subject, studentClass, section, terminal, year) => {
  // to Check if model already exists
  if (mongoose.models[`Practicalproject_${subject}_${studentClass}_${section}_${terminal}_${year}`]) {
    return mongoose.models[`Practicalproject_${subject}_${studentClass}_${section}_${terminal}_${year}`];
  }
  return mongoose.model(`Practicalproject_${subject}_${studentClass}_${section}_${terminal}_${year}`, FinalPracticalSlipSchema, `Practicalproject_${subject}_${studentClass}_${section}_${terminal}_${year}`);
};
const getPracticalProjectModel = (subject, studentClass, section, year) => {
  // to Check if model already exists
  if (mongoose.models[`Practicalproject_${subject}_${studentClass}_${section}_${year}`]) {
    return mongoose.models[`Practicalproject_${subject}_${studentClass}_${section}_${year}`];
  }
  return mongoose.model(`Practicalproject_${subject}_${studentClass}_${section}_${year}`, practicalprojectSchema, `Practicalproject_${subject}_${studentClass}_${section}_${year}`);
};

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
    let newsubjectList = await newsubject.find({}).lean();
    
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
exports.choosesubject = async (req,res)=>
  {
    res.render("theme/choosesubject",{...await getSidenavData(req),editing: false})
  }
exports.evaluationForm = async (req, res) => {
  const {studentClass,section,subject,terminal} = req.query;
  console.log(studentClass,section);
  if(studentClass==='1' || studentClass==='2' || studentClass==='3') {
    return res.render("theme/theme", {...await getSidenavData(req),editing: false, studentClass, section});
  } else {
     return res.render("theme/practicalform410pannel", {...await getSidenavData(req),editing: false, studentClass, section,subject,terminal});
  }
};
exports.showpracticalDetailForm = async (req, res) => {
  console.log('=== FUNCTION CALLED: showpracticalDetailForm ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const { studentClass, section, subject,terminal } = req.query;
    
    console.log('=== QUERY PARAMETERS ===');
    console.log('studentClass:', studentClass);
    console.log('section:', section);
    console.log('subject:', subject);
    console.log('All query params:', JSON.stringify(req.query, null, 2));
    
    console.log('=== GETTING PRACTICAL FORMAT ===');
    const practicalFormat = getThemeFormat(studentClass);
    console.log('practicalFormat model created');
    
    console.log('=== SEARCHING FOR PRACTICAL FORMAT DATA ===');
    const practicalFormatData = await practicalFormat.find({
      studentClass: studentClass,
      subject: subject
    }).lean();
    
    console.log('practicalFormatData found:', practicalFormatData.length, 'records');
    
    console.log('=== CHECKING SUBJECT TYPE ===');
    console.log('Subject value:', `"${subject}"`);

    console.log('Subject === "SCIENCE":', subject === "SCIENCE");
    console.log('Subject.toUpperCase() === "SCIENCE":', subject && subject.toUpperCase() === "SCIENCE");
    
    if (subject === "SCIENCE" ) {
      console.log('🔬 === SUBJECT DETECTED ===');      
      console.log('=== SEARCHING FOR SCIENCE DATA ===');
      console.log('ScienceModel:', typeof ScienceModel);
      
      const ScienceData = await ScienceModel.find({
        studentClass: studentClass,
        terminal: terminal,
        subject: subject
      }).lean();
      
      console.log('✅ Science data query completed');
      console.log('Science data found:', ScienceData.length, 'records');
      
      if (ScienceData.length > 0) {
        console.log('📊 Science data preview:');
        ScienceData.forEach((data, index) => {
          console.log(`Record ${index + 1}:`, {
            id: data._id,
            studentClass: data.studentClass,
            subject: data.subject,
            unitsCount: data.units ? data.units.length : 0
          });
        });
      } else {
        console.log('⚠️  NO SCIENCE DATA FOUND');
        console.log('Let me check what science data exists...');
        
          const allScienceData = await ScienceModel.find({studentClass:studentClass,terminal:terminal}).lean();
          console.log('Total science records in database:', allScienceData.length);
          console.log(allScienceData)
          if (allScienceData.length > 0) {
            console.log('Available science data:');
            allScienceData.forEach((data, index) => {
              console.log(`${index + 1}. Class: "${data.studentClass}", Subject: "${data.subject}"`);
            });
        } else {
          console.log('❌ NO SCIENCE DATA EXISTS IN DATABASE AT ALL');
        }
      }
      
      console.log('🎨 Rendering practicalprojectform...');
     
      return res.render("theme/practicalprojectform", {
        ...await getSidenavData(req), 
        editing: false, 
        studentClass, 
        section, 
        subject, 
        practicalFormatData, 
        ScienceData,
        terminal
      });

      
    } 
   else if (subject === "MATHEMATICS" ) {
      console.log('🔬 === SUBJECT DETECTED ===');      
      console.log('=== SEARCHING FOR SCIENCE DATA ===');
      console.log('ScienceModel:', typeof ScienceModel);
      
      const ScienceData = await ScienceModel.find({
        studentClass: studentClass,
        terminal: terminal,
        subject: subject
      }).lean();
      
      console.log('✅ Science data query completed');
      console.log('Science data found:', ScienceData.length, 'records');
      
      if (ScienceData.length > 0) {
        console.log('📊 Science data preview:');
        ScienceData.forEach((data, index) => {
          console.log(`Record ${index + 1}:`, {
            id: data._id,
            studentClass: data.studentClass,
            subject: data.subject,
            unitsCount: data.units ? data.units.length : 0
          });
        });
      } else {
        console.log('⚠️  NO SCIENCE DATA FOUND');
        console.log('Let me check what science data exists...');
        
          const allScienceData = await ScienceModel.find({studentClass:studentClass,terminal:terminal}).lean();
          console.log('Total science records in database:', allScienceData.length);
          console.log(allScienceData)
          if (allScienceData.length > 0) {
            console.log('Available science data:');
            allScienceData.forEach((data, index) => {
              console.log(`${index + 1}. Class: "${data.studentClass}", Subject: "${data.subject}"`);
            });
        } else {
          console.log('❌ NO SCIENCE DATA EXISTS IN DATABASE AT ALL');
        }
      }
      
      console.log('🎨 Rendering practicalprojectform...');

      return res.render("theme/mathProjectForm", {
        ...await getSidenavData(req),
        editing: false,
        studentClass,
        section,
        subject,
        practicalFormatData, 
        ScienceData,
        terminal
      });

      
    } 
    else if (subject === "SOCIAL" ) {
      console.log('🔬 === SUBJECT DETECTED ===');      
      console.log('=== SEARCHING FOR SCIENCE DATA ===');
      console.log('ScienceModel:', typeof ScienceModel);
      
      const ScienceData = await ScienceModel.find({
        studentClass: studentClass,
        terminal: terminal,
        subject: subject
      }).lean();
      
      console.log('✅ Science data query completed');
      console.log('Science data found:', ScienceData.length, 'records');
      
      if (ScienceData.length > 0) {
        console.log('📊 Science data preview:');
        ScienceData.forEach((data, index) => {
          console.log(`Record ${index + 1}:`, {
            id: data._id,
            studentClass: data.studentClass,
            subject: data.subject,
            unitsCount: data.units ? data.units.length : 0
          });
        });
      } else {
        console.log('⚠️  NO SCIENCE DATA FOUND');
        console.log('Let me check what science data exists...');
        
          const allScienceData = await ScienceModel.find({studentClass:studentClass,terminal:terminal}).lean();
          console.log('Total science records in database:', allScienceData.length);
          console.log(allScienceData)
          if (allScienceData.length > 0) {
            console.log('Available science data:');
            allScienceData.forEach((data, index) => {
              console.log(`${index + 1}. Class: "${data.studentClass}", Subject: "${data.subject}"`);
            });
        } else {
          console.log('❌ NO SCIENCE DATA EXISTS IN DATABASE AT ALL');
        }
      }
      
      console.log('🎨 Rendering practicalprojectform...');

      return res.render("theme/socialProjectForm", {
        ...await getSidenavData(req),
        editing: false,
        studentClass,
        section,
        subject,
        practicalFormatData, 
        ScienceData,
        terminal
      });

      
    } 
    else if (subject === "HEALTH" ) {
      console.log('🔬 === SUBJECT DETECTED ===');      
      console.log('=== SEARCHING FOR SCIENCE DATA ===');
      console.log('ScienceModel:', typeof ScienceModel);
      
      const ScienceData = await ScienceModel.find({
        studentClass: studentClass,
        terminal: terminal,
        subject: subject
      }).lean();
      
      console.log('✅ Science data query completed');
      console.log('Science data found:', ScienceData.length, 'records');
      
      if (ScienceData.length > 0) {
        console.log('📊 Science data preview:');
        ScienceData.forEach((data, index) => {
          console.log(`Record ${index + 1}:`, {
            id: data._id,
            studentClass: data.studentClass,
            subject: data.subject,
            unitsCount: data.units ? data.units.length : 0
          });
        });
      } else {
        console.log('⚠️  NO SCIENCE DATA FOUND');
        console.log('Let me check what science data exists...');
        
          const allScienceData = await ScienceModel.find({studentClass:studentClass,terminal:terminal}).lean();
          console.log('Total science records in database:', allScienceData.length);
          console.log(allScienceData)
          if (allScienceData.length > 0) {
            console.log('Available science data:');
            allScienceData.forEach((data, index) => {
              console.log(`${index + 1}. Class: "${data.studentClass}", Subject: "${data.subject}"`);
            });
        } else {
          console.log('❌ NO SCIENCE DATA EXISTS IN DATABASE AT ALL');
        }
      }
      
      console.log('🎨 Rendering practicalprojectform...');

      return res.render("theme/healthProjectForm", {
        ...await getSidenavData(req),
        editing: false,
        studentClass,
        section,
        subject,
        practicalFormatData, 
        ScienceData,
        terminal
      });

      
    } 
    else 
      {
      console.log('📝 === NON-SCIENCE SUBJECT ===');
      console.log('Subject is not SCIENCE, rendering regular form');
      console.log('Subject value was:', `"${subject}"`);
      
      console.log('🎨 Rendering practicaldetailform...');
      return res.render("theme/practicaldetailform", {
        ...await getSidenavData(req), 
        editing: false, 
        studentClass, 
        section, 
        subject, 
        practicalFormatData,
        terminal
      });
    }
    
  } catch (err) {
    console.error('❌ === ERROR in showpracticalDetailForm ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Full error object:', err);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      stack: err.stack
    });
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
  const { studentClass, section, subject,terminal } = req.query;
  console.log(studentClass, section, subject,terminal);

  if(subject==="SCIENCE")
  {
    if(terminal==="FINAL")
    {
      const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section, acadamicYear);
        

     const sciencepracticaldata = await model.aggregate([
       {
         $match: {
           studentClass: studentClass,
           section: section,
           subject: subject,
         }
       },
       {
         $group: {
           _id: { roll: "$roll", name: "$name", studentClass: "$studentClass" ,section: "$section"}, terminals: { $push: "$$ROOT" }, attendanceTotalmarks: { $sum: "$attendanceMarks" }, participationTotalmarks: { $sum: "$participationMarks" },
           
         }
       }
     ]);


     const lessonData = await ScienceModel.aggregate([
       {
         $match: {
           studentClass: studentClass,
           subject: subject
         }
       },
       {
         $group: {
           _id: { studentClass: "$studentClass", subject: "$subject" },
            totalLessons: { $push: "$$ROOT" }
         }
       }
     ]);

console.log(marksheetSetting)
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/projectpracticalslipfinal", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
    
    else
    { 
      const marksheetSetting = await marksheetSetup.find();
      const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section,  acadamicYear);
        const sciencepracticaldata = await model.find({studentClass:studentClass,terminalName:terminal,subject:subject});
     const lessonData = await ScienceModel.find({studentClass:studentClass,terminal:terminal,subject:subject});

    
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/projectpracticalslip", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});

    }
  }

   else if(subject==="MATHEMATICS")
  {
    if(terminal==="FINAL")
    {
const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section,acadamicYear);

     const sciencepracticaldata = await model.aggregate([
       {
         $match: {
           studentClass: studentClass,
           section: section,
           subject: subject,
         }
       },
       {
         $group: {
           _id: { roll: "$roll", name: "$name", studentClass: "$studentClass" ,section: "$section"}, terminals: { $push: "$$ROOT" }, attendanceTotalmarks: { $sum: "$attendanceMarks" }, participationTotalmarks: { $sum: "$participationMarks" },
           
         }
       }
     ]);


     const lessonData = await ScienceModel.aggregate([
       {
         $match: {
           studentClass: studentClass,
           subject: subject
         }
       },
       {
         $group: {
           _id: { studentClass: "$studentClass", subject: "$subject" },
            totalLessons: { $push: "$$ROOT" }
         }
       }
     ]);

console.log(marksheetSetting)
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/mathslipfinal", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
    
    else
    { 
    const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section, acadamicYear);
        const sciencepracticaldata = await model.find({studentClass:studentClass,terminalName:terminal,subject:subject});
     const lessonData = await ScienceModel.find({studentClass:studentClass,terminal:terminal,subject:subject});

    
     
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/mathslip", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});

    }
  }
   else if(subject==="SOCIAL")
  {
    if(terminal==="FINAL")
    {
const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section,  acadamicYear);

     const sciencepracticaldata = await model.aggregate([
       {
         $match: {
           studentClass: studentClass,
           section: section,
           subject: subject,
         }
       },
       {
         $group: {
           _id: { roll: "$roll", name: "$name", studentClass: "$studentClass" ,section: "$section"}, terminals: { $push: "$$ROOT" }, attendanceTotalmarks: { $sum: "$attendanceMarks" }, participationTotalmarks: { $sum: "$participationMarks" },
           
         }
       }
     ]);


     const lessonData = await ScienceModel.aggregate([
       {
         $match: {
           studentClass: studentClass,
           subject: subject
         }
       },
       {
         $group: {
           _id: { studentClass: "$studentClass", subject: "$subject" },
            totalLessons: { $push: "$$ROOT" }
         }
       }
     ]);

console.log(marksheetSetting)
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/socialslipfinal", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
    
    else 
    { 
    const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section, acadamicYear);
        const sciencepracticaldata = await model.find({studentClass:studentClass,terminalName:terminal,subject:subject});
     const lessonData = await ScienceModel.find({studentClass:studentClass,terminal:terminal,subject:subject});

    
     
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/socialslip", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});

    }
  }
else
{
  const practicalDetail = getStudentThemeData(studentClass);
  const practicalDetailData = await practicalDetail.find().lean();



  res.render("theme/practicalslip", {...await getSidenavData(req), editing: false, studentClass, section, subject, practicalDetailData});
}
}catch(err)
{

}



}

exports.sciencepracticalForm = async (req,res,next)=>
{
  try
  {
const { studentClass, section, subject,terminal } = req.query;
if(subject==="HEALTH")
{
  return res.render("theme/healthpracticalform",{studentClass,section,subject,terminal});
}
else
{


    console.log(studentClass,section,subject,terminal)
    res.render("theme/sciencepracticalform",{studentClass,section,subject,terminal});
}

  }catch(err)
  {
    console.log(err);
    
  }

}
 exports.saveSciencePractical = async (req, res, next) => {
  try {
    console.log('Raw form data received:', JSON.stringify(req.body, null, 2));
    
    // Process and clean the form data
    let { studentClass, section, subject, terminal, units } = req.body;
    
    // Transform units data to handle different input formats
    if (units && Array.isArray(units)) {
      units = units.map(unit => {
        const processedUnit = {
          unitName: unit.unitName,
          portion: unit.portion || '',
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
      terminal,
      units: units ? units.length : 0,
      unitsDetail: units ? units.map((unit, index) => ({
        unitIndex: index,
        unitName: unit.unitName,
        portion: unit.portion || '',
        practicals: unit.practicals ? unit.practicals.length : 0,
        projectworks: unit.projectworks ? unit.projectworks.length : 0,
        practicalsData: unit.practicals,
        projectworksData: unit.projectworks
      })) : []
    });

    // Validate required fields
    if (!studentClass || !subject || !terminal) {
      return res.status(400).json({ 
        error: 'Student class, subject, and terminal are required' 
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
      terminal,
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
        terminal,
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
    const { roll, name, studentClass, section, subject, terminal, units } = req.body;

    // Validate required fields
    if (!roll || !name || !studentClass || !subject || !terminal) {
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
      terminal,
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
      terminal
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
        terminal,
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

exports.savepracticalprojectform = async (req,res,next)=>
{

try{

  const {  studentClass, section, subject, terminal } = req.query;
  console.log('Received practical project form data:', {
    studentClass,
    section,
    subject,
    terminal
  });

req.body.unit.forEach(unit => {
  unit.practicals = unit.practicals || [];
  unit.projectWorks = unit.projectWorks || [];

  // --- PRACTICALS ---
  unit.practicals.forEach(practical => {
    if (!practical.criteria) {
      practical.criteria = []; // nothing selected
      return;
    }

    // Convert object-of-arrays into clean array
    practical.criteria = Object.values(practical.criteria).flatMap(row =>
      Object.values(row).map(v => {
        const [marks, indicator, adhar] = v.split("||");
        return {
          practicalIndicatorMarks: Number(marks),
          practicalIndicator: indicator,
          practicalAdhar: adhar
        };
      })
    );
  });

  // --- PROJECTS ---
  unit.projectWorks.forEach(project => {
    if (!project.criteria) {
      project.criteria = [];
      return;
    }

    project.criteria = Object.values(project.criteria).map(v => {
      const [marks, indicator, adhar] = v.split("||");
      return {
        projectIndicatorMarks: Number(marks),
        projectIndicator: indicator,
        projectAdhar: adhar
      };
    });
  });
});

const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section, acadamicYear);

const doc = new model(req.body);
await doc.save();

    return res.status(201).json({
        success: true,
        message: 'Science student record created successfully',
        data: doc
      });

}catch(err)
{
  console.log(err)
  res.status(500).json({error:'Internal server error',details:err.message});
}
}

exports.savepracticalslip = async (req,res,next)=>
{
   try {
    const slips = req.body.slip; // this will be an array of student slips
const {studentClass,section,subject,terminal,academicYear} = req.query;
    // Example schema
    // slipModel = mongoose.model("Slip", new mongoose.Schema({
    //   roll: String, name: String, studentClass: String, section: String,
    //   attendanceParticipation: Number, practicalProject: Number,
    //   terminal: Number, total: Number, grade: String
    // }));
const model = getSubjectSlipModelForPractical(subject, studentClass, section, terminal, academicYear);
    await model.insertMany(slips);

    res.send("Slip saved successfully!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving slip");
  }
}
exports.internalReport = async (req, res) => {
  const {studentClass, section, subject, terminal} = req.query;

  if(subject==="SCIENCE")
  {
    if(terminal==="FINAL")
    {
const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section,  acadamicYear);

     const sciencepracticaldata = await model.aggregate([
       {
         $match: {
           studentClass: studentClass,
           section: section,
           subject: subject,
         }
       },
       {
         $group: {
           _id: { roll: "$roll", name: "$name", studentClass: "$studentClass" ,section: "$section"}, terminals: { $push: "$$ROOT" }, attendanceTotalmarks: { $sum: "$attendanceMarks" }, participationTotalmarks: { $sum: "$participationMarks" },
           
         }
       }
     ]);


     const lessonData = await ScienceModel.aggregate([
       {
         $match: {
           studentClass: studentClass,
           subject: subject
         }
       },
       {
         $group: {
           _id: { studentClass: "$studentClass", subject: "$subject" },
            totalLessons: { $push: "$$ROOT" }
         }
       }
     ]);

console.log(marksheetSetting)
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/scienceinternalReportFinal", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
    
    else
    { 
    const marksheetSetting = await marksheetSetup.find();
      const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section, acadamicYear);
        const sciencepracticaldata = await model.find({studentClass:studentClass,terminalName:terminal,subject:subject});
     const lessonData = await ScienceModel.find({studentClass:studentClass,terminal:terminal,subject:subject});
      res.render("theme/scienceinternalReport", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
  }


  else if(subject==="MATHEMATICS")
  {
    if(terminal==="FINAL")
    {
const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section,  acadamicYear);

     const sciencepracticaldata = await model.aggregate([
       {
         $match: {
           studentClass: studentClass,
           section: section,
           subject: subject,
         }
       },
       {
         $group: {
           _id: { roll: "$roll", name: "$name", studentClass: "$studentClass" ,section: "$section"}, terminals: { $push: "$$ROOT" }, attendanceTotalmarks: { $sum: "$attendanceMarks" }, participationTotalmarks: { $sum: "$participationMarks" },
           
         }
       }
     ]);


     const lessonData = await ScienceModel.aggregate([
       {
         $match: {
           studentClass: studentClass,
           subject: subject
         }
       },
       {
         $group: {
           _id: { studentClass: "$studentClass", subject: "$subject" },
            totalLessons: { $push: "$$ROOT" }
         }
       }
     ]);

console.log(marksheetSetting)
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/mathinternalReportFinal", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
    
    else
    { 
    const marksheetSetting = await marksheetSetup.find();
      const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section, acadamicYear);
        const sciencepracticaldata = await model.find({studentClass:studentClass,terminalName:terminal,subject:subject});
     const lessonData = await ScienceModel.find({studentClass:studentClass,terminal:terminal,subject:subject});
      res.render("theme/MathinternalReport", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
  }
  else if(subject==="SOCIAL")
  {
    if(terminal==="FINAL")
    {
const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section,  acadamicYear);

     const sciencepracticaldata = await model.aggregate([
       {
         $match: {
           studentClass: studentClass,
           section: section,
           subject: subject,
         }
       },
       {
         $group: {
           _id: { roll: "$roll", name: "$name", studentClass: "$studentClass" ,section: "$section"}, terminals: { $push: "$$ROOT" }, attendanceTotalmarks: { $sum: "$attendanceMarks" }, participationTotalmarks: { $sum: "$participationMarks" },
           
         }
       }
     ]);


     const lessonData = await ScienceModel.aggregate([
       {
         $match: {
           studentClass: studentClass,
           subject: subject
         }
       },
       {
         $group: {
           _id: { studentClass: "$studentClass", subject: "$subject" },
            totalLessons: { $push: "$$ROOT" }
         }
       }
     ]);

console.log(marksheetSetting)
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/socialinternalReportFinal", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
    
    else
    { 
    const marksheetSetting = await marksheetSetup.find();
      const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section, acadamicYear);
        const sciencepracticaldata = await model.find({studentClass:studentClass,terminalName:terminal,subject:subject});
     const lessonData = await ScienceModel.find({studentClass:studentClass,terminal:terminal,subject:subject});
      res.render("theme/socialinternalReport", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
  }
  else if(subject==="HEALTH")
  {
    if(terminal==="FINAL")
    {
const marksheetSetting = await marksheetSetup.find();
     const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section,  acadamicYear);

     const sciencepracticaldata = await model.aggregate([
       {
         $match: {
           studentClass: studentClass,
           section: section,
           subject: subject,
         }
       },
       {
         $group: {
           _id: { roll: "$roll", name: "$name", studentClass: "$studentClass" ,section: "$section"}, terminals: { $push: "$$ROOT" }, attendanceTotalmarks: { $sum: "$attendanceMarks" }, participationTotalmarks: { $sum: "$participationMarks" },
           
         }
       }
     ]);


     const lessonData = await ScienceModel.aggregate([
       {
         $match: {
           studentClass: studentClass,
           subject: subject
         }
       },
       {
         $group: {
           _id: { studentClass: "$studentClass", subject: "$subject" },
            totalLessons: { $push: "$$ROOT" }
         }
       }
     ]);

console.log(marksheetSetting)
     console.log("projectdata",sciencepracticaldata);
     console.log("lesson Data", lessonData)
      res.render("theme/healthinternalReportFinal", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
    
    else
    { 
    const marksheetSetting = await marksheetSetup.find();
      const acadamicYear = marksheetSetting[0].acadamicYear;
       const model = getPracticalProjectModel(subject, studentClass, section, acadamicYear);
        const sciencepracticaldata = await model.find({studentClass:studentClass,terminalName:terminal,subject:subject});
     const lessonData = await ScienceModel.find({studentClass:studentClass,terminal:terminal,subject:subject});
      res.render("theme/healthInternalReport", {...await getSidenavData(req), editing: false, studentClass, section, subject, sciencepracticaldata, lessonData,terminal,marksheetSetting});
    }
  }

  }

