const axios = require('axios');

// Test form data that mimics what the form should send
const testFormData = new URLSearchParams({
  'studentClass': '6',
  'subject': 'Math',
  'credit': '4',
  'themes[0][themeName]': 'Test Theme',
  'themes[0][learningOutcome][0][learningOutcomeName]': 'Test Learning Outcome',
  'themes[0][learningOutcome][0][indicators][0][indicatorName]': 'Test Indicator',
  'themes[0][learningOutcome][0][indicators][0][indicatorsMarks]': '5',
  'themes[0][learningOutcome][0][totalMarks]': '5'
});

console.log('Sending test form data...');
console.log('Form data:', testFormData.toString());

axios.post('http://localhost/themefillupform?studentClass=6', testFormData, {
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
})
.then(response => {
  console.log('Response status:', response.status);
  console.log('Response data:', response.data.substring(0, 500) + '...');
})
.catch(error => {
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Response status:', error.response.status);
    console.error('Response data:', error.response.data);
  }
});
