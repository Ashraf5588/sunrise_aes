const mongoose = require('mongoose')

const themeSchemaFor1 = new mongoose.Schema(
  {
    studentClass: {type:String, required:false},
    subject:{ type:String, required:false},
    credit: {type:Number,required:false},
    themes: [
            {
                themeName: {type:String, required:false},
                learningOutcome: [

                  {
                    learningOutcomeName: {type:String, required:false},
                     indicators: [
                      {
                        indicatorName: {type:String, required:false},
                        indicatorsMarks: {type:Number, required:false},
                      

                     }],
                     totalMarks : {type:Number, required:false},
                  }
                ],
            }
        ],
    date: {type:Date, required:false},
    teacherName: {type:String, required:false},
    

  }
)
module.exports = { themeSchemaFor1 }