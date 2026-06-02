# Fix: Allow Multiple Test Assignments to Same Student

## Problem
- Students could not be assigned the same test multiple times
- The `TestAssignment` model had a unique constraint on `(testId, studentId)` that prevented duplicate assignments
- This prevented scenarios like:
  - Reassigning a test after it was completed
  - Giving a student multiple attempts at the same test with different deadlines
  - Creating new assignment records for retry attempts

## Solution Implemented

### 1. Database Schema Change
**File**: `platform/prisma/schema.prisma`
- Removed the unique constraint `@@unique([testId, studentId])` from the `TestAssignment` model
- This allows multiple assignment records for the same test-student combination

### 2. Database Migration Applied
**Script**: `platform/execute-migration.js`
- Executed SQL: `ALTER TABLE "TestAssignment" DROP CONSTRAINT IF EXISTS "TestAssignment_testId_studentId_key";`
- Successfully dropped the existing constraint from the database

### 3. Prisma Client Updated
- Ran `npx prisma generate` to regenerate the Prisma client to reflect schema changes

### 4. Frontend UI Updated
**File**: `frontend/src/pages/admin/TestsPage.tsx` (AssignModal component)
- Removed the filter that excluded already-assigned students from the selection list
- Changed line 124 from: `{filtered.filter((s) => !assigned.has(s.id)).map((s) => (`
- To: `{filtered.map((s) => (`
- Now displays an "Already assigned" indicator for students who have existing assignments
- Students can be selected for reassignment, creating a new assignment record

### 5. Backend API (No changes needed)
- The API endpoint already handles this correctly in `platform/src/app/api/test-assignments/route.ts`
- The try-catch block that was catching unique constraint violations will no longer trigger those errors
- Multiple assignments to the same student will now be created successfully

## How It Works Now
1. Admin navigates to Tests > Assign in the admin dashboard
2. Can select any students, including those already assigned the test
3. Students marked as "Already assigned" will get a new assignment record
4. Each assignment can have different:
   - Due dates
   - Availability windows
   - Max attempts
5. Students can see all their test assignments and take multiple attempts based on the assignment settings

## Testing
To verify the fix works:
1. Assign a test to a student
2. Go back to the same test's assign modal
3. The student should now appear in the selection list with "Already assigned" label
4. Select them again to create a new assignment record
5. Check the database - should have multiple rows for the same testId+studentId combination
