# Bugfix Requirements Document

## Introduction

The Vehicle Registry table in the Gate Entry section currently displays a "View Docs" button in the INPUT column. When clicked, this button opens a modal showing detailed driver's license and vehicle registration information. This bug fix removes all license data content from the modal while preserving the table structure and other functionality.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user clicks the "📄 View Docs" button in the INPUT column THEN the system displays a modal containing driver's license information (license number, date of birth, issue date, expiry date, blood group, vehicle class)

1.2 WHEN a user clicks the "📄 View Docs" button in the INPUT column THEN the system displays a modal containing vehicle registration certificate information (registration number, vehicle type, owner name, company, registration date, status, insurance validity)

1.3 WHEN the license card modal is open THEN the system shows sensitive personal information derived from vehicle data (license number derived from plate number, hardcoded date of birth, blood group)

### Expected Behavior (Correct)

2.1 WHEN a user clicks the "📄 View Docs" button in the INPUT column THEN the system SHALL NOT display any driver's license information

2.2 WHEN a user clicks the "📄 View Docs" button in the INPUT column THEN the system SHALL NOT display any vehicle registration certificate information

2.3 WHEN a user clicks the "📄 View Docs" button in the INPUT column THEN the system SHALL either display an empty modal or not open a modal at all

### Unchanged Behavior (Regression Prevention)

3.1 WHEN viewing the Vehicle Registry table THEN the system SHALL CONTINUE TO display the INPUT column header

3.2 WHEN viewing the Vehicle Registry table THEN the system SHALL CONTINUE TO display the "📄 View Docs" button for each vehicle row

3.3 WHEN viewing the Vehicle Registry table THEN the system SHALL CONTINUE TO display all other columns (PLATE, OWNER, FOOTAGE, ACTION) with their existing functionality

3.4 WHEN a user clicks the "📹 View" button in the FOOTAGE column THEN the system SHALL CONTINUE TO display the vehicle footage modal correctly

3.5 WHEN a user clicks the "Blacklist" button in the ACTION column THEN the system SHALL CONTINUE TO function correctly

3.6 WHEN a user clicks the "Register Vehicle" button THEN the system SHALL CONTINUE TO open the vehicle registration modal correctly

3.7 WHEN viewing other sections of the Gate Entry page (Access Log Feed, AI Analysis Log Feed, Visitor Management) THEN the system SHALL CONTINUE TO function without any changes
