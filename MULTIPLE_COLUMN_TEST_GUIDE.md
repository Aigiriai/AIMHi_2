# Multiple Column Selection Test Guide

## Issue Description
Users report that when selecting multiple columns for a report, only one column gets added to the Report Matrix Layout, and the SQL query is buggy.

## Comprehensive Logging Added

### Frontend Logging (Browser Console)
Look for these log patterns when testing:

#### 1. Field Selection Tracking
- `🎯 MATRIX_REPORT: Column button clicked for field: [fieldName]`
- `🎯 MATRIX_REPORT: Adding field to columns: [fieldName]`
- `🎯 MATRIX_REPORT: Before column addition - Current state:`

#### 2. State Change Monitoring
- `🎯 MATRIX_REPORT: Selection state changed:`
- Shows real-time updates of selectedRows, selectedColumns, selectedMeasures

#### 3. Report Execution
- `🎯 MATRIX_REPORT: Execute report triggered`
- `🎯 MATRIX_REPORT: Current selections before execution:`
- `🎯 MATRIX_REPORT: Sending report request:`

### Backend Logging (Server Console)
Look for these log patterns:

#### 1. API Request Processing
- `📊 REPORT_API[ID]: POST /api/report/execute requested`
- `📊 REPORT_API[ID]: Request body received:`
- `📊 REPORT_API[ID]: Detailed field selections:`

#### 2. SQL Generation
- `🔧 REPORT_SQL: Generating query with request:`
- `🔧 REPORT_SQL: Detailed selections:`
- `🔧 REPORT_SQL: All fields combined:`
- `🔧 REPORT_SQL: Mapped field:` (for each field)
- `🔧 REPORT_SQL: Generated final query:`

## Test Scenarios

### Scenario 1: Basic Multiple Column Test
1. Navigate to Recruitment > Reports
2. Select "Jobs" table
3. Click "→ Columns" for "Job Title" 
4. Click "→ Columns" for "Job Status"
5. Click "→ Columns" for "Department" (if available)
6. Check the Report Matrix Layout - should show 3 columns
7. Click "Execute Report"

**Expected Logs:**
- Multiple "Column button clicked" entries
- "Adding field to columns" for each field
- Final state should show selectedColumns array with 3 items
- SQL should include all 3 fields in SELECT clause

### Scenario 2: Mixed Row and Column Test
1. Select "Jobs" table
2. Click "→ Rows" for "Job Title"
3. Click "→ Columns" for "Job Status" 
4. Click "→ Columns" for "Department"
5. Check Matrix Layout shows 1 row, 2 columns
6. Execute report

**Expected Logs:**
- State should show: rows: 1, columns: 2, measures: 0
- SQL should GROUP BY the row field

### Scenario 3: Measure Addition Test
1. Select "Jobs" table
2. Click "→ Columns" for "Job Status"
3. Click "→ Columns" for "Department"
4. Check the "Count" measure (if available)
5. Execute report

**Expected Logs:**
- selectedMeasures should include "count"
- SQL should include COUNT(*) aggregation

## Debugging Steps

### If Only One Column Appears:
1. Check console for `🎯 MATRIX_REPORT: Selection state changed:`
2. Look at the selectedColumns array - does it contain all expected fields?
3. If array is correct but UI shows only one, it's a display issue
4. If array only has one field, check the `addFieldToColumns` logs

### If SQL is Buggy:
1. Look for `🔧 REPORT_SQL: Generated final query:`
2. Check if all selected columns appear in the SELECT clause
3. Verify the field mapping is working correctly
4. Check for any SQL syntax errors

### Key Log Messages to Watch:
- **Problem**: `🎯 MATRIX_REPORT: Field already in columns, no change`
  - **Meaning**: Trying to add a field that's already selected
  
- **Problem**: `🔧 REPORT_SQL: Using default COUNT query - no fields selected`
  - **Meaning**: No fields reached the SQL generation (frontend issue)
  
- **Success**: `🔧 REPORT_SQL: Final select fields: [array with multiple items]`
  - **Meaning**: Multiple fields properly processed

## Test Results Template
Please share these details:

```
### Test Scenario: [Basic Multiple Column Test]

**Frontend Console Logs:**
[Paste relevant 🎯 MATRIX_REPORT logs here]

**Backend Console Logs:**
[Paste relevant 📊 REPORT_API and 🔧 REPORT_SQL logs here]

**UI Behavior:**
- Fields selected: [list]
- Fields visible in Matrix Layout: [list]
- Report results: [success/error]

**Issue Observed:**
[Describe what went wrong]
```

## Expected Fix Verification
After the fix, you should see:
1. Multiple fields properly added to selectedColumns array
2. All selected fields visible in Matrix Layout Columns section
3. SQL query includes all selected fields in SELECT clause
4. Report executes successfully with proper column headers
