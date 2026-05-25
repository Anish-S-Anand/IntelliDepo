# Remove Vehicle Registry License Data - Bugfix Design

## Overview

This bugfix removes all driver's license and vehicle registration certificate information from the "View Docs" modal in the Vehicle Registry table. The modal currently displays sensitive personal information including license numbers, dates of birth, blood groups, and vehicle registration details. The fix will empty the modal content while preserving the button, table structure, and all other Gate Entry functionality.

The approach is to remove the license card modal content entirely, leaving either an empty modal or preventing the modal from opening. This is a minimal, targeted fix that eliminates the display of sensitive data without affecting any other functionality in the Gate Entry page.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a user clicks the "📄 View Docs" button in the Vehicle Registry INPUT column
- **Property (P)**: The desired behavior when the View Docs button is clicked - no license or registration data should be displayed
- **Preservation**: All other Gate Entry functionality (table display, other buttons, other modals, other sections) that must remain unchanged
- **showLicenseCard**: The React state boolean in `GateConsolePage.tsx` that controls the visibility of the license card modal
- **selectedVehicle**: The React state variable in `GateConsolePage.tsx` that stores the currently selected vehicle data for the modal
- **License Card Modal**: The modal component (lines 1831-1951 in GateConsolePage.tsx) that displays driver's license and vehicle registration information

## Bug Details

### Bug Condition

The bug manifests when a user clicks the "📄 View Docs" button in the INPUT column of the Vehicle Registry table. The `showLicenseCard` state is set to `true` and `selectedVehicle` is populated, causing the modal to render with sensitive personal information including hardcoded and derived data.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UserClickEvent
  OUTPUT: boolean
  
  RETURN input.buttonClicked == "View Docs Button"
         AND input.location == "Vehicle Registry INPUT Column"
         AND modalDisplaysLicenseData(input)
END FUNCTION
```

### Examples

- **Example 1**: User clicks "📄 View Docs" for vehicle "MH-12-AB-1234" → Modal opens showing driver's license with license number "MH12AB12341", DOB "15 Aug 1985", blood group "O+", and vehicle registration details
- **Example 2**: User clicks "📄 View Docs" for vehicle "DL-01-XY-5678" → Modal opens showing driver's license with derived license number, hardcoded DOB, and full vehicle registration certificate
- **Example 3**: User clicks "📄 View Docs" for any vehicle → Modal displays sensitive personal information that should not be shown
- **Edge Case**: User clicks "📄 View Docs" when vehicle has minimal data → Modal still displays hardcoded values like "15 Aug 1985" for DOB and "O+" for blood group

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The Vehicle Registry table must continue to display with all columns (PLATE, OWNER, FOOTAGE, INPUT, ACTION)
- The "📄 View Docs" button must continue to appear in the INPUT column for each vehicle row
- The INPUT column header must continue to be displayed
- Mouse clicks on the "📹 View" button in the FOOTAGE column must continue to open the footage modal correctly
- Mouse clicks on the "Blacklist" button in the ACTION column must continue to function correctly
- The "Register Vehicle" button must continue to open the vehicle registration modal correctly
- All other sections of the Gate Entry page (Access Log Feed, AI Analysis Log Feed, Visitor Management) must continue to function without any changes

**Scope:**
All interactions that do NOT involve clicking the "📄 View Docs" button should be completely unaffected by this fix. This includes:
- Viewing the Vehicle Registry table
- Clicking other buttons (View Footage, Blacklist, Register Vehicle)
- Interacting with other Gate Entry sections
- All other page functionality

## Hypothesized Root Cause

Based on the bug description and code analysis, the issue is:

1. **Modal Content Display**: The license card modal (lines 1831-1951) contains two card sections that display sensitive information:
   - Driver's License Card (lines 1847-1895): Shows license number (derived from plate number), hardcoded DOB, issue/expiry dates, blood group, and vehicle class
   - Vehicle Registration Card (lines 1898-1949): Shows registration number, vehicle type, owner name, company, registration date, status, and insurance validity

2. **Hardcoded Sensitive Data**: The modal includes hardcoded personal information:
   - Date of Birth: "15 Aug 1985" (line 1871)
   - Blood Group: "O+" (line 1887)

3. **Derived Sensitive Data**: The modal derives license numbers from plate numbers:
   - License Number: `selectedVehicle.plate_number.replace(/-/g, '').substring(0, 10)` (line 1867)

4. **Click Handler**: The "View Docs" button click handler (lines 1617-1620) sets `showLicenseCard` to `true` and populates `selectedVehicle`, triggering the modal to render with all this sensitive data

## Correctness Properties

Property 1: Bug Condition - No License Data Display

_For any_ user click on the "📄 View Docs" button in the Vehicle Registry INPUT column, the system SHALL NOT display any driver's license information (license number, date of birth, issue date, expiry date, blood group, vehicle class) or vehicle registration certificate information (registration number, vehicle type, owner name, company, registration date, status, insurance validity).

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Table and Other Functionality

_For any_ user interaction that is NOT clicking the "📄 View Docs" button (viewing the table, clicking other buttons, interacting with other sections), the system SHALL produce exactly the same behavior as the original code, preserving all existing functionality including table display, column headers, other buttons, other modals, and all other Gate Entry sections.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `frontend/src/components/depot/operations/GateConsolePage.tsx`

**Function/Component**: License Card Modal (lines 1831-1951)

**Specific Changes**:

**Option 1: Remove Modal Content (Recommended)**
1. **Remove Driver's License Card Section**: Delete lines 1847-1895 (entire driver's license card div)
2. **Remove Vehicle Registration Card Section**: Delete lines 1898-1949 (entire vehicle registration card div)
3. **Keep Modal Shell**: Retain the modal wrapper (lines 1831-1846 and 1950-1951) with title and close button, but display a message like "No documents available" or leave it empty
4. **Alternative**: Replace both card sections with a single message: "Document information has been removed"

**Option 2: Prevent Modal from Opening**
1. **Modify Click Handler**: Change the "View Docs" button click handler (lines 1617-1620) to do nothing or show a toast message
2. **Remove Modal Rendering**: Optionally remove the entire modal rendering block (lines 1831-1951) since it will never be shown

**Option 3: Remove Button and Modal Entirely**
1. **Remove Button**: Delete the "📄 View Docs" button (lines 1614-1624)
2. **Remove Modal**: Delete the entire license card modal (lines 1831-1951)
3. **Remove State Variables**: Remove `showLicenseCard` and `selectedVehicle` state declarations (lines 408-410)
4. **Note**: This violates preservation requirement 3.2 (button must continue to be displayed)

**Recommended Approach**: Option 1 - Remove modal content but keep the modal shell and button. This satisfies all requirements:
- Removes all license and registration data (Requirements 2.1, 2.2)
- Keeps the button visible (Requirement 3.2)
- Keeps the INPUT column header (Requirement 3.1)
- Preserves all other functionality (Requirements 3.3-3.7)

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (verify sensitive data is currently displayed), then verify the fix works correctly (no data displayed) and preserves existing behavior (table and other buttons still work).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that the modal currently displays sensitive license and registration data.

**Test Plan**: Write tests that simulate clicking the "View Docs" button and assert that the modal displays license data. Run these tests on the UNFIXED code to observe the sensitive data being rendered and confirm the bug exists.

**Test Cases**:
1. **License Data Display Test**: Click "View Docs" for a vehicle → Assert modal contains driver's license section with license number, DOB, blood group (will pass on unfixed code, confirming bug)
2. **Registration Data Display Test**: Click "View Docs" for a vehicle → Assert modal contains vehicle registration section with registration number, owner name, company (will pass on unfixed code, confirming bug)
3. **Hardcoded Data Test**: Click "View Docs" for any vehicle → Assert modal displays hardcoded "15 Aug 1985" and "O+" (will pass on unfixed code, confirming bug)
4. **Derived Data Test**: Click "View Docs" for vehicle "MH-12-AB-1234" → Assert modal displays derived license number "MH12AB1234" (will pass on unfixed code, confirming bug)

**Expected Counterexamples**:
- Modal displays driver's license card with sensitive personal information
- Modal displays vehicle registration card with vehicle and owner details
- Hardcoded values ("15 Aug 1985", "O+") appear in the modal
- License numbers are derived from plate numbers and displayed

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (clicking "View Docs"), the fixed code produces the expected behavior (no license data displayed).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := clickViewDocsButton_fixed(input)
  ASSERT NOT containsLicenseData(result)
  ASSERT NOT containsRegistrationData(result)
END FOR
```

**Test Plan**: After implementing the fix, click "View Docs" buttons and verify that no license or registration data is displayed.

**Test Cases**:
1. **No License Data Test**: Click "View Docs" for any vehicle → Assert modal does NOT contain driver's license section
2. **No Registration Data Test**: Click "View Docs" for any vehicle → Assert modal does NOT contain vehicle registration section
3. **No Hardcoded Data Test**: Click "View Docs" for any vehicle → Assert modal does NOT display "15 Aug 1985" or "O+"
4. **No Derived Data Test**: Click "View Docs" for vehicle "MH-12-AB-1234" → Assert modal does NOT display "MH12AB1234"
5. **Modal Behavior Test**: Click "View Docs" → Assert modal either shows empty content or displays a "no documents" message

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (all other interactions), the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) = fixedBehavior(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for table display and other buttons, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Table Display Preservation**: Observe that Vehicle Registry table displays correctly with all columns on unfixed code, then verify this continues after fix
2. **INPUT Column Header Preservation**: Observe that INPUT column header is displayed on unfixed code, then verify this continues after fix
3. **View Docs Button Preservation**: Observe that "📄 View Docs" button appears for each vehicle row on unfixed code, then verify this continues after fix
4. **Footage Modal Preservation**: Click "📹 View" button on unfixed code and observe footage modal opens correctly, then verify this continues after fix
5. **Blacklist Button Preservation**: Click "Blacklist" button on unfixed code and observe it functions correctly, then verify this continues after fix
6. **Register Vehicle Preservation**: Click "Register Vehicle" button on unfixed code and observe modal opens correctly, then verify this continues after fix
7. **Other Sections Preservation**: Interact with Access Log Feed, AI Analysis Log Feed, and Visitor Management on unfixed code, then verify these continue to work after fix

### Unit Tests

- Test that clicking "View Docs" button does not display license data
- Test that clicking "View Docs" button does not display registration data
- Test that "View Docs" button is still rendered in the table
- Test that INPUT column header is still displayed
- Test that other buttons (View Footage, Blacklist) continue to work

### Property-Based Tests

- Generate random vehicle data and verify clicking "View Docs" never displays license or registration information
- Generate random user interactions (clicking different buttons, viewing different sections) and verify all non-View-Docs interactions produce the same behavior as before
- Test that table structure and column headers remain unchanged across many scenarios

### Integration Tests

- Test full Gate Entry page flow with Vehicle Registry table display
- Test clicking "View Docs" button and verifying no sensitive data appears
- Test switching between different Gate Entry sections and verifying all functionality works
- Test that visual feedback (button hover states, modal animations) continues to work correctly
