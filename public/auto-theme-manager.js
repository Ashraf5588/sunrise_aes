/**
 * Auto Theme Manager
 * 
 * This script handles:
 * 1. Auto-initialization of student records with default marks (0) on page load
 * 2. Auto-saving of form data as teachers enter marks (without clicking save)
 * 3. Persistent data management between sessions
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Auto Theme Manager loaded');
  
  // Global debounce timer for auto-save
  let autoSaveTimeout = null;
  
  // Get page parameters
  const urlParams = new URLSearchParams(window.location.search);
  const subject = urlParams.get('subject') || document.getElementById('subject')?.value || '';
  const studentClass = urlParams.get('studentClass') || document.getElementById('studentClass')?.value || '';
  const section = urlParams.get('section') || document.getElementById('section')?.value || '';
  
  // Configuration
  const AUTO_SAVE_DELAY = 2000; // 2 seconds after input stops
  const AUTO_INIT_DELAY = 1000; // 1 second after page load
  
  /**
   * Get all students in the current class/section
   */
  async function getAllStudents() {
    try {
      console.log(`Fetching students for class ${studentClass}, section ${section}`);
      const response = await fetch(`/student_data/${encodeURIComponent(subject)}/${studentClass}/${encodeURIComponent(section)}`);
      
      if (!response.ok) {
        console.error('Error fetching student data:', response.statusText);
        return [];
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  }
  
  /**
   * Initialize default records for all students in class
   */
  async function initializeStudentRecords() {
    console.log('Initializing default student records...');
    
    try {
      // Show loading indicator
      showInitializationProgress('Preparing student data...');
      
      // Get all students in the class
      const students = await getAllStudents();
      console.log(`Found ${students.length} students in class ${studentClass} ${section}`);
      
      if (students.length === 0) {
        hideInitializationProgress();
        return;
      }
      
      // Get all theme options
      const themeOptions = Array.from(document.querySelectorAll('#themeName option, [id^="themeName-"] option'))
        .filter(option => option.value && option.value !== 'default' && !option.disabled)
        .map(option => option.value);
      
      if (themeOptions.length === 0) {
        console.warn('No themes available for initialization');
        hideInitializationProgress();
        return;
      }
      
      console.log(`Found ${themeOptions.length} themes for initialization`);
      
      // Process each student
      let processedCount = 0;
      for (const student of students) {
        updateInitializationProgress(`Processing student ${processedCount + 1}/${students.length}: ${student.name}`);
        
        // For each student, initialize a record for each theme
        for (const themeName of themeOptions) {
          await initializeStudentThemeRecord(student, themeName);
        }
        
        processedCount++;
      }
      
      updateInitializationProgress(`All ${students.length} student records initialized!`);
      setTimeout(hideInitializationProgress, 2000);
      
      console.log('Student record initialization complete');
      
    } catch (error) {
      console.error('Error initializing student records:', error);
      hideInitializationProgress();
    }
  }
  
  /**
   * Initialize a single student's record for a specific theme
   */
  async function initializeStudentThemeRecord(student, themeName) {
    try {
      // First check if a record already exists
      const existingData = await checkExistingStudentThemeRecord(student.roll, themeName);
      
      // If data already exists, no need to create defaults
      if (existingData && existingData.found) {
        return;
      }
      
      // Create a default record for this student and theme
      const formData = buildDefaultFormData(student, themeName);
      
      // Send to server
      await fetch('/theme/form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          autosave: 'true',
          ajax: 'true'
        })
      });
      
    } catch (error) {
      console.error(`Error initializing record for student ${student.roll}, theme ${themeName}:`, error);
    }
  }
  
  /**
   * Check if a student already has a record for a specific theme
   */
  async function checkExistingStudentThemeRecord(roll, themeName) {
    try {
      const response = await fetch(`/theme/previous-data?roll=${encodeURIComponent(roll)}&subject=${encodeURIComponent(subject)}&themeName=${encodeURIComponent(themeName)}&studentClass=${encodeURIComponent(studentClass)}&section=${encodeURIComponent(section)}`);
      
      if (!response.ok) {
        return { success: false, found: false };
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error checking existing theme record:', error);
      return { success: false, found: false };
    }
  }
  
  /**
   * Build default form data for a student with zeroes for all marks
   */
  function buildDefaultFormData(student, themeName) {
    // Get theme data structure from the page
    const themeData = getThemeStructure(themeName);
    
    // Basic student info
    const formData = {
      roll: student.roll,
      name: student.name,
      studentClass: studentClass,
      section: section,
      subjects: [{
        name: subject,
        themes: [{
          themeName: themeName,
          learningOutcomes: []
        }]
      }]
    };
    
    // Add learning outcomes with zero marks
    if (themeData && themeData.learningOutcomes) {
      formData.subjects[0].themes[0].learningOutcomes = themeData.learningOutcomes.map(outcome => {
        const outcomeData = {
          name: outcome.name,
          evaluationDate: new Date().toISOString().split('T')[0], // Today's date
          indicators: [],
          totalMarksBeforeIntervention: 0,
          totalMarksAfterIntervention: 0
        };
        
        // Add indicators with zero marks
        if (outcome.indicators) {
          outcomeData.indicators = outcome.indicators.map(indicator => ({
            name: indicator.name,
            maxMarks: indicator.maxMarks || 10,
            marksBeforeIntervention: 0,
            marksAfterIntervention: 0,
            toolsUsed: ''
          }));
        }
        
        return outcomeData;
      });
      
      // Add overall totals
      formData.subjects[0].themes[0].overallTotalBefore = 0;
      formData.subjects[0].themes[0].overallTotalAfter = 0;
    }
    
    return formData;
  }
  
  /**
   * Extract theme structure (learning outcomes, indicators) from the page
   */
  function getThemeStructure(themeName) {
    // Find the wrapper for this theme
    const themeWrapper = document.querySelector(`.learning-outcome-wrapper[data-theme="${themeName}"]`);
    if (!themeWrapper) return null;
    
    const learningOutcomes = [];
    
    // Process each learning outcome section
    themeWrapper.querySelectorAll('.learning-outcome-section').forEach(section => {
      const outcomeName = section.querySelector('h2')?.textContent?.trim();
      if (!outcomeName) return;
      
      // Get indicators from table headers
      const table = section.querySelector('table.evaluation-table');
      if (!table) return;
      
      const headerCells = table.querySelectorAll('thead th');
      const indicators = [];
      
      // Get all indicators except the last one (which is "Total Marks")
      headerCells.forEach((cell, index) => {
        if (index < headerCells.length - 1) {
          const name = cell.textContent.trim();
          
          // Try to get max marks from data attributes or defaults to 10
          let maxMarks = 10;
          const markInputs = table.querySelectorAll('.marks-input');
          if (markInputs[index]) {
            maxMarks = parseFloat(markInputs[index].dataset.maxMarks) || 10;
          }
          
          indicators.push({
            name,
            maxMarks
          });
        }
      });
      
      learningOutcomes.push({
        name: outcomeName,
        indicators
      });
    });
    
    return {
      themeName,
      learningOutcomes
    };
  }
  
  /**
   * Set up auto-save for all input fields in the form
   */
  function setupAutoSave() {
    console.log('Setting up auto-save functionality');
    
    // For each form in the page
    document.querySelectorAll('.themeEvaluationForm').forEach(form => {
      const studentIndex = form.getAttribute('data-student-index');
      
      // Listen for input events on all form fields
      form.addEventListener('input', function(event) {
        const target = event.target;
        
        // Only proceed if this is an input field we care about
        if (target.classList.contains('marks-input') || 
            target.type === 'date' ||
            target.classList.contains('tools-input')) {
          
          // Clear existing timeout
          clearTimeout(autoSaveTimeout);
          
          // Schedule auto-save
          autoSaveTimeout = setTimeout(() => {
            autoSaveForm(studentIndex);
          }, AUTO_SAVE_DELAY);
          
          // Update visual indication that changes are pending
          showSavingIndicator('pending');
        }
      });
    });
  }
  
  /**
   * Auto-save the form data
   */
  async function autoSaveForm(studentIndex = null) {
    console.log(`Auto-saving form for student index: ${studentIndex}`);
    
    try {
      // Show saving indicator
      showSavingIndicator('saving');
      
      // Get form element
      const formId = studentIndex !== null ? `themeEvaluationForm-${studentIndex}` : 'themeEvaluationForm';
      const form = document.getElementById(formId);
      
      if (!form) {
        console.error(`Form with ID ${formId} not found`);
        showSavingIndicator('error');
        return;
      }
      
      // Check if we have required data
      const rollId = studentIndex !== null ? `roll-${studentIndex}` : 'roll';
      const themeNameId = studentIndex !== null ? `themeName-${studentIndex}` : 'themeName';
      
      const roll = document.getElementById(rollId)?.value;
      const themeName = document.getElementById(themeNameId)?.value;
      
      if (!roll || !themeName) {
        console.log('Missing roll or theme name, cannot auto-save');
        showSavingIndicator('incomplete');
        return;
      }
      
      // Create form data
      const formData = new FormData(form);
      formData.append('autosave', 'true');
      formData.append('ajax', 'true');
      formData.append('updatedAt', new Date().toISOString());
      
      // Send form data to server
      const response = await fetch('/theme/form', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        console.error('Error saving form:', response.statusText);
        showSavingIndicator('error');
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log('Auto-save successful:', result);
        showSavingIndicator('success');
        
        // Store form data in localStorage as backup
        storeFormBackup(formId, form);
      } else {
        console.error('Auto-save failed:', result);
        showSavingIndicator('error');
      }
    } catch (error) {
      console.error('Error in auto-save:', error);
      showSavingIndicator('error');
    }
  }
  
  /**
   * Store form data in localStorage as a backup
   */
  function storeFormBackup(formId, form) {
    try {
      const formData = new FormData(form);
      const data = {};
      
      for (const [key, value] of formData.entries()) {
        // Skip file inputs
        if (value instanceof File) continue;
        data[key] = value;
      }
      
      const backupData = {
        timestamp: new Date().toISOString(),
        data: data
      };
      
      localStorage.setItem(`themeForm_${formId}_backup`, JSON.stringify(backupData));
    } catch (error) {
      console.error('Error storing form backup:', error);
    }
  }
  
  /**
   * Show initialization progress indicator
   */
  function showInitializationProgress(message) {
    let progressElement = document.getElementById('initialization-progress');
    
    if (!progressElement) {
      progressElement = document.createElement('div');
      progressElement.id = 'initialization-progress';
      progressElement.className = 'progress-indicator';
      progressElement.innerHTML = `
        <div class="progress-spinner"></div>
        <div class="progress-message"></div>
      `;
      
      // Styles
      progressElement.style.position = 'fixed';
      progressElement.style.top = '20px';
      progressElement.style.right = '20px';
      progressElement.style.backgroundColor = 'rgba(52, 152, 219, 0.9)';
      progressElement.style.color = 'white';
      progressElement.style.padding = '15px 20px';
      progressElement.style.borderRadius = '4px';
      progressElement.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
      progressElement.style.zIndex = '9999';
      progressElement.style.display = 'flex';
      progressElement.style.alignItems = 'center';
      progressElement.style.gap = '10px';
      
      document.body.appendChild(progressElement);
      
      // Add styles for spinner
      const style = document.createElement('style');
      style.textContent = `
        .progress-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    progressElement.querySelector('.progress-message').textContent = message;
    progressElement.style.display = 'flex';
  }
  
  /**
   * Update initialization progress message
   */
  function updateInitializationProgress(message) {
    const progressElement = document.getElementById('initialization-progress');
    if (progressElement) {
      progressElement.querySelector('.progress-message').textContent = message;
    }
  }
  
  /**
   * Hide initialization progress indicator
   */
  function hideInitializationProgress() {
    const progressElement = document.getElementById('initialization-progress');
    if (progressElement) {
      progressElement.style.display = 'none';
    }
  }
  
  /**
   * Show auto-save indicator
   * @param {string} status - 'pending', 'saving', 'success', 'error', 'incomplete'
   */
  function showSavingIndicator(status) {
    let indicator = document.getElementById('auto-save-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'auto-save-indicator';
      indicator.className = 'save-indicator';
      
      // Style the indicator
      indicator.style.position = 'fixed';
      indicator.style.bottom = '20px';
      indicator.style.right = '20px';
      indicator.style.padding = '8px 15px';
      indicator.style.borderRadius = '4px';
      indicator.style.fontSize = '14px';
      indicator.style.fontWeight = '500';
      indicator.style.zIndex = '9999';
      indicator.style.transition = 'all 0.3s ease';
      
      document.body.appendChild(indicator);
    }
    
    // Update the indicator based on status
    switch (status) {
      case 'pending':
        indicator.textContent = 'Changes pending...';
        indicator.style.backgroundColor = '#f39c12';
        indicator.style.color = 'white';
        break;
      case 'saving':
        indicator.textContent = 'Saving...';
        indicator.style.backgroundColor = '#3498db';
        indicator.style.color = 'white';
        break;
      case 'success':
        indicator.textContent = 'Saved ✓';
        indicator.style.backgroundColor = '#2ecc71';
        indicator.style.color = 'white';
        // Auto-hide after 3 seconds
        setTimeout(() => {
          indicator.style.opacity = '0';
          setTimeout(() => {
            indicator.style.display = 'none';
            indicator.style.opacity = '1';
          }, 300);
        }, 3000);
        break;
      case 'error':
        indicator.textContent = 'Error saving! ✗';
        indicator.style.backgroundColor = '#e74c3c';
        indicator.style.color = 'white';
        break;
      case 'incomplete':
        indicator.textContent = 'Missing information';
        indicator.style.backgroundColor = '#95a5a6';
        indicator.style.color = 'white';
        // Auto-hide after 2 seconds
        setTimeout(() => {
          indicator.style.opacity = '0';
          setTimeout(() => {
            indicator.style.display = 'none';
            indicator.style.opacity = '1';
          }, 300);
        }, 2000);
        break;
    }
    
    indicator.style.display = 'block';
  }
  
  // Initialize the auto-save functionality
  setupAutoSave();
  
  // Initialize default records with a short delay
  setTimeout(initializeStudentRecords, AUTO_INIT_DELAY);
});
