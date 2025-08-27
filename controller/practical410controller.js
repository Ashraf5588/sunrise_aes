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
const {ThemeEvaluationSchema,practicalSchema} = require("../model/themeformschema");
// Use the already created model from the schema file

const {themeSchemaFor1} = require("../model/themeschema")

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
  const practicalFormatData = await practicalFormat.find().lean();

  res.render("theme/practicaldetailform", {...await getSidenavData(req), editing: false, studentClass, section, subject, practicalFormatData});
  
};
exports.savepracticalDetailForm = async (req, res) => { 

  try{
    async function savePractical(data) {
      let {studentClass} = req.body;
      let { roll, name,  section, subject, terminal } =data; 
const practicalModel = getStudentThemeData(studentClass);
      let studentExist = await practicalModel.findOne({ roll, studentClass, section, subject });
      if(!studentExist){
        studentExist = new practicalModel({ 
          roll,
          name,
          studentClass, 
          section, 
          terminal: [
            {
              terminalName: terminal.terminalName,
              totalAttendance: terminal.totalAttendance,
              attendanceMarks: terminal.attendanceMarks,
              subject: [
                {
                  subjectName: subject,
                  praticipationIndicator: terminal.subject[0].praticipationIndicator,
                  participationMarks: terminal.subject[0].participationMarks,
                  theoryMarks: terminal.subject[0].theoryMarks,
                  terminalMarks: terminal.subject[0].terminalMarks,
                  mulyangkanAdhar: terminal.subject[0].mulyangkanAdhar.map(mulyangkan => ({
                    mulyangkanName: mulyangkan.mulyangkanName,
                    prixyanPakxya: mulyangkan.prixyanPakxya,
                    praptaSuchak: mulyangkan.praptaSuchak,
                    praptangka: mulyangkan.praptangka
                  })),
                  totalObtained: terminal.subject[0].totalObtained
            }
          ] 
            }
        ]
        });
        await studentExist.save();
      }
      else
      {
        const terminalIndex = student.terminal.findIndex(
      (t) => t.terminalName === terminalName
    );
      if (terminalIndex === -1) {
        student.terminal.push({
        terminalName,
        totalAttendance,
        attendanceMarks: 0,
        subject: subjectData, // 8 subjects
      });
      } else {
        student.terminal[terminalIndex] = terminal;
      }
      await student.save();
    }
  } catch (err) {
    console.error('Error saving practical detail form:', err);
    res.status(500).send('Internal Server Error');
  }

};
    }
  }catch(err){
    console.error('Error saving practical detail form:', err);
    res.status(500).send('Internal Server Error');
  }

};