const mongoose = require('mongoose');
const { themeSchemaFor1 } = require('./model/themeschema');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/stud', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Test the schema
const testSchema = () => {
  console.log('Testing theme schema...');
  console.log('Schema structure:', Object.keys(themeSchemaFor1.obj));
  console.log('Full schema:', JSON.stringify(themeSchemaFor1.obj, null, 2));
  
  // Create a test model
  const TestModel = mongoose.model('TestTheme', themeSchemaFor1, 'testTheme');
  
  // Create test data
  const testData = {
    studentClass: "6",
    subject: "Math",
    credit: 4,
    themes: [
      {
        themeName: "Test Theme",
        learningOutcome: [
          {
            learningOutcomeName: "Test Learning Outcome",
            indicators: [
              {
                indicatorName: "Test Indicator",
                indicatorsMarks: 5
              }
            ],
            totalMarks: 5
          }
        ]
      }
    ]
  };
  
  console.log('Test data to save:', JSON.stringify(testData, null, 2));
  
  // Try to create and save the document
  TestModel.create(testData)
    .then(result => {
      console.log('Successfully saved test data:', result);
      console.log('Document fields:', Object.keys(result.toObject()));
      process.exit(0);
    })
    .catch(error => {
      console.error('Error saving test data:', error);
      process.exit(1);
    });
};

mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
  testSchema();
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});
