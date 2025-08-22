/**
 * Theme Loader Fix - Ensures proper theme selection and data loading on page reload
 * This script addresses issues with theme selection not persisting and data not loading correctly
 * when the page is refreshed.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Store current URL parameters for later use
  const urlParams = new URLSearchParams(window.location.search);
  
  // Get all the theme selector elements
  const themeSelectors = document.querySelectorAll('select[id^="themeName-"]');
  
  // For each theme selector, ensure it has the right event listeners
  themeSelectors.forEach(themeSelector => {
    if (!themeSelector) return;
    
    const studentIndex = themeSelector.getAttribute('data-student-index');
    if (!studentIndex) return;
    
    const rollField = document.getElementById(`roll-${studentIndex}`);
    if (!rollField) return;
    
    // Store original theme selection change handler
    const originalOnChange = themeSelector.onchange;
    
    // Replace with enhanced version that stores selection in sessionStorage
    themeSelector.onchange = function(event) {
      const selectedTheme = this.value;
      const rollValue = rollField.value;
      
      if (selectedTheme && rollValue) {
        // Store the selection in sessionStorage
        sessionStorage.setItem(`selectedTheme_${studentIndex}_${rollValue}`, selectedTheme);
      }
      
      // Call the original handler (filterLearningOutcomes)
      if (typeof originalOnChange === 'function') {
        originalOnChange.call(this, event);
      }
      
      // Trigger loadPreviousData after theme selection changes
      if (window.loadPreviousData) {
        window.loadPreviousData(studentIndex);
      }
    };
    
    // Also listen for roll number changes to restore theme selections
    rollField.addEventListener('change', function() {
      const rollValue = this.value.trim();
      if (!rollValue) return;
      
      // Try to get previously selected theme for this roll number
      const savedTheme = sessionStorage.getItem(`selectedTheme_${studentIndex}_${rollValue}`);
      
      if (savedTheme && themeSelector.querySelector(`option[value="${savedTheme}"]`)) {
        // Restore previous selection
        themeSelector.value = savedTheme;
        
        // Trigger the change event
        const event = new Event('change', { bubbles: true });
        themeSelector.dispatchEvent(event);
        
        console.log(`Restored theme selection for student #${studentIndex}, roll ${rollValue}: ${savedTheme}`);
      }
    });
  });
  
  // Add handler for single-student view (non-indexed elements)
  const mainThemeSelector = document.getElementById('themeName');
  const mainRollField = document.getElementById('roll');
  
  if (mainThemeSelector && mainRollField) {
    const originalOnChange = mainThemeSelector.onchange;
    
    mainThemeSelector.onchange = function(event) {
      const selectedTheme = this.value;
      const rollValue = mainRollField.value;
      
      if (selectedTheme && rollValue) {
        // Store the selection in sessionStorage
        sessionStorage.setItem(`selectedTheme_main_${rollValue}`, selectedTheme);
      }
      
      // Call the original handler
      if (typeof originalOnChange === 'function') {
        originalOnChange.call(this, event);
      }
      
      // Trigger loadPreviousData
      if (window.loadPreviousData) {
        window.loadPreviousData();
      }
    };
    
    mainRollField.addEventListener('change', function() {
      const rollValue = this.value.trim();
      if (!rollValue) return;
      
      // Try to get previously selected theme for this roll number
      const savedTheme = sessionStorage.getItem(`selectedTheme_main_${rollValue}`);
      
      if (savedTheme && mainThemeSelector.querySelector(`option[value="${savedTheme}"]`)) {
        // Restore previous selection
        mainThemeSelector.value = savedTheme;
        
        // Trigger the change event
        const event = new Event('change', { bubbles: true });
        mainThemeSelector.dispatchEvent(event);
        
        console.log(`Restored theme selection for main form, roll ${rollValue}: ${savedTheme}`);
      }
    });
  }
  
  // Special function to trigger theme loading immediately after page load
  function triggerInitialDataLoad() {
    // Find all roll fields with values
    document.querySelectorAll('input[id^="roll-"]').forEach(roll => {
      if (!roll.value.trim()) return;
      
      const studentIndex = roll.id.split('-')[1];
      const themeSelect = document.getElementById(`themeName-${studentIndex}`);
      
      if (themeSelect && themeSelect.value) {
        // Force loading of data with small delay to ensure page is ready
        setTimeout(() => {
          console.log(`Auto-loading data for student #${studentIndex}, roll ${roll.value}, theme ${themeSelect.value}`);
          if (window.loadPreviousData) {
            window.loadPreviousData(studentIndex);
          }
        }, 500);
      }
    });
    
    // Also check main form (if exists)
    if (mainRollField && mainRollField.value && mainThemeSelector && mainThemeSelector.value) {
      setTimeout(() => {
        console.log(`Auto-loading data for main form, roll ${mainRollField.value}, theme ${mainThemeSelector.value}`);
        if (window.loadPreviousData) {
          window.loadPreviousData();
        }
      }, 500);
    }
  }
  
  // Run initial data load after short delay
  setTimeout(triggerInitialDataLoad, 800);
});
