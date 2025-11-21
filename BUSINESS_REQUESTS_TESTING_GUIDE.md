# Business Requests Feature - Testing Guide

## Overview

This document provides comprehensive testing instructions for the Business Requests feature, which allows job seekers to submit applications to businesses and business owners to manage and respond to these requests.

## Components and Files Created

### Backend/Database
- **Migration**: `supabase/migrations/042_create_business_requests_system.sql`
  - Tables: `business_requests`, `business_request_responses`
  - Indexes: Business, user, status-based queries optimized
  - RLS Policies: Row-level security implemented for data access control

### Service Layer
- **File**: `src/lib/businessRequestService.js`
- **Methods**:
  - `getAllBusinesses()` - Fetch active businesses
  - `getBusinessDetails()` - Get specific business info
  - `submitBusinessRequest()` - Submit job application
  - `getUserRequests()` - View user's own requests
  - `getBusinessRequests()` - View requests for a business (owner only)
  - `updateRequestStatus()` - Update request status
  - `withdrawRequest()` - User withdraws their request
  - `submitResponse()` - Business owner responds to request
  - `getResponsesForRequest()` - View all responses for a request

### UI Components

#### 1. BusinessCatalog (Existing - Job Seeker View)
- **File**: `src/components/BusinessCatalog.jsx`
- **Features**:
  - Browse all active businesses
  - Search by business name, location, or registration number
  - Pagination (12 businesses per page)
  - Click to submit business request
  - Shows business details: name, location, registration number, TIN

#### 2. BusinessRequestModal (Existing - Job Seeker Application Form)
- **File**: `src/components/BusinessRequestModal.jsx`
- **Fields**:
  - Occupation/Position *
  - Requested Salary
  - Currency (PHP/USD/EUR)
  - Skills (add/remove) *
  - Resume/Professional Bio *
  - Availability Date
  - Message to business owner
- **Validation**: Occupation, at least 1 skill, and resume text required

#### 3. BusinessRequestsManager (New - Business Owner Dashboard)
- **File**: `src/components/BusinessRequestsManager.jsx`
- **Features**:
  - View all business requests
  - Filter by status: pending, reviewed, accepted, rejected, withdrawn
  - Show statistics: total, pending, reviewed, accepted
  - Expandable request cards showing:
    - Occupation, requested salary, skills, resume
    - Applicant's message
    - All responses sent
  - Actions based on request status:
    - Send response (for pending/reviewed)
    - Mark as reviewed (for pending)
    - Reject (for pending/reviewed)

#### 4. BusinessRequestResponseModal (New - Business Owner Response Form)
- **File**: `src/components/BusinessRequestResponseModal.jsx`
- **Response Types**:
  - Schedule Interview (needs_interview)
    - Business asks for further discussion
  - Make Job Offer (hire_request)
    - Conditional fields: Position Title, Offered Salary
    - Shows when selecting this option
  - Decline Application (offer_rejected)
    - Polite rejection option
- **Fields**:
  - Response Status * (radio buttons)
  - Position Title * (if offer)
  - Offered Salary (optional)
  - Message to Applicant *

#### 5. Jobs Component Updates
- **File**: `src/components/Jobs.jsx`
- **Changes**:
  - Added "Businesses" main tab
  - Shows BusinessCatalog for job seekers
  - Shows BusinessRequestsManager for business owners
  - Imports BusinessRequestsManager

## End-to-End Testing Flow

### Test Case 1: Job Seeker Submits Business Request

**Actors**: 
- User A (Job Seeker - no businesses)
- Business owned by User B

**Steps**:
1. Login as User A
2. Navigate to Jobs & Employment > Businesses tab
3. See list of registered businesses in BusinessCatalog
4. Search for a specific business
5. Click "Request Job / Apply" button
6. Fill BusinessRequestModal:
   - Occupation: "Sales Manager"
   - Requested Salary: "50000"
   - Add Skills: "Sales", "Client Relations", "Leadership"
   - Resume: Detailed professional summary
   - Message: Cover letter
7. Click "Submit Application"
8. **Expected**: Request appears in database with status 'pending'

**Verification**:
```sql
SELECT * FROM business_requests 
WHERE requesting_user_id = 'user_a_id' 
AND business_id = 'business_id';
```
Should show 1 row with status 'pending'

---

### Test Case 2: Business Owner Views Incoming Requests

**Actors**:
- User B (Business Owner)
- Multiple requests from different users

**Steps**:
1. Login as User B
2. Navigate to Jobs & Employment > Businesses tab
3. See BusinessRequestsManager instead of BusinessCatalog
4. View statistics:
   - Total requests count
   - Pending requests count
   - Reviewed requests count
   - Accepted requests count
5. Filter by status:
   - All (default)
   - Pending only
   - Reviewed only
   - Accepted only
   - Rejected only
   - Withdrawn only
6. Expand a request card to see details
7. **Expected**: All requests visible with proper filtering

**Verification**:
```sql
SELECT status, COUNT(*) FROM business_requests 
WHERE business_id = 'business_id' 
GROUP BY status;
```
Should match displayed statistics

---

### Test Case 3: Business Owner Responds to Request

**Actors**:
- User B (Business Owner)
- Request from User A

**Steps**:
1. Login as User B
2. Navigate to Businesses tab
3. Find request from User A
4. Click "Send Response" button
5. Choose "Make Job Offer" response type
6. Fill form:
   - Position Title: "Senior Sales Manager"
   - Offered Salary: "60000"
   - Message: Detailed job offer
7. Click "Send Response"
8. **Expected**: Response created, request status changes to 'reviewed'

**Verification**:
```sql
SELECT * FROM business_request_responses 
WHERE request_id = 'request_id';
```
Should show 1 row with response_status 'hire_request'

```sql
SELECT status FROM business_requests WHERE id = 'request_id';
```
Should show 'reviewed'

---

### Test Case 4: Business Owner Schedules Interview

**Actors**:
- User B (Business Owner)
- Request from User A

**Steps**:
1. Login as User B
2. Navigate to Businesses tab
3. Find request from User A
4. Click "Send Response" button
5. Choose "Schedule Interview" response type
6. Fill form:
   - Message: "We'd like to schedule an interview with you next week..."
7. Click "Send Response"
8. **Expected**: Response created with status 'needs_interview'

**Verification**:
```sql
SELECT response_status FROM business_request_responses 
WHERE request_id = 'request_id';
```
Should show 'needs_interview'

---

### Test Case 5: Mark Request as Reviewed

**Actors**:
- User B (Business Owner)
- Pending request

**Steps**:
1. Login as User B
2. Navigate to Businesses tab
3. Find pending request
4. Click "Mark as Reviewed" button
5. **Expected**: Request status changes from 'pending' to 'reviewed'

**Verification**:
```sql
SELECT status FROM business_requests WHERE id = 'request_id';
```
Should show 'reviewed'

---

### Test Case 6: Reject Application

**Actors**:
- User B (Business Owner)
- Request from User A

**Steps**:
1. Login as User B
2. Navigate to Businesses tab
3. Find pending or reviewed request
4. Click "Reject" button
5. **Expected**: Request status changes to 'rejected'

**Verification**:
```sql
SELECT status FROM business_requests WHERE id = 'request_id';
```
Should show 'rejected'

---

### Test Case 7: Request Filtering and Search

**Actors**:
- User B (Business Owner)
- Multiple requests with different statuses

**Steps**:
1. Login as User B
2. Navigate to Businesses tab
3. Test filter dropdown:
   - Select "Pending" - should show only pending requests
   - Select "Reviewed" - should show only reviewed requests
   - Select "Accepted" - should show only accepted requests
   - Select "Rejected" - should show only rejected requests
4. Select "All Requests" - should show all
5. **Expected**: Filtering works correctly

---

### Test Case 8: Multiple Responses to Same Request

**Actors**:
- User B (Business Owner)
- User C (Another business owner with same business)
- Single request

**Setup**: Create a request to a business

**Steps**:
1. Login as User B
2. Navigate to Businesses tab
3. Find request
4. Send response: "Schedule Interview"
5. Expand request details
6. See response displayed
7. Click "Send Response" again
8. Send another response: "Make Job Offer"
9. Expand request details
10. **Expected**: Both responses visible in responses section

**Verification**:
```sql
SELECT COUNT(*) FROM business_request_responses 
WHERE request_id = 'request_id';
```
Should show 2 or more responses

---

### Test Case 9: Business Selection in Businesses Tab

**Actors**:
- User B (Business Owner with 2+ businesses)

**Steps**:
1. Create User B with 2 businesses
2. Login as User B
3. Navigate to Businesses tab
4. See BusinessRequestsManager for first business
5. See business requests for selected business only
6. If business selector exists, switch businesses
7. **Expected**: Requests change based on selected business

**Verification**:
Both businesses should have independent request lists

---

### Test Case 10: RLS Policy Enforcement

**Actors**:
- User A (Job Seeker)
- User B (Business Owner)
- User C (Another user)

**Setup**: User A submits request to User B's business

**Test Steps**:

**A. User A should see own requests**:
```sql
-- As User A
SELECT * FROM business_requests 
WHERE requesting_user_id = auth.uid();
```
Should return User A's requests only

**B. User B should see requests for their business**:
```sql
-- As User B
SELECT * FROM business_requests 
WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid());
```
Should return all requests for User B's businesses

**C. User C should see nothing**:
```sql
-- As User C
SELECT * FROM business_requests;
```
Should return empty due to RLS policies

---

## UI/UX Testing

### BusinessCatalog
- [ ] Search functionality works
- [ ] Pagination works (12 items per page)
- [ ] Business cards show all info correctly
- [ ] "Request Job / Apply" button is visible and clickable
- [ ] Empty state message shown when no results
- [ ] Loading spinner appears while fetching

### BusinessRequestModal
- [ ] Form fields validate correctly
- [ ] Skills can be added/removed
- [ ] Currency dropdown has PHP, USD, EUR
- [ ] Character counter shows for resume
- [ ] Submit button disabled during loading
- [ ] Success message appears after submission
- [ ] Modal closes on close button

### BusinessRequestsManager
- [ ] Statistics display correct counts
- [ ] Filter dropdown changes displayed requests
- [ ] Request cards expand/collapse
- [ ] Expanded view shows all details
- [ ] "Send Response" button visible for pending/reviewed
- [ ] "Mark as Reviewed" button visible for pending
- [ ] "Reject" button visible for pending/reviewed
- [ ] Response history shows all previous responses
- [ ] Empty state when no requests

### BusinessRequestResponseModal
- [ ] Radio buttons for response types are clear
- [ ] Conditional fields appear/disappear correctly
- [ ] "Make Job Offer" shows position and salary fields
- [ ] Message field has character counter
- [ ] Form validates correctly
- [ ] Submit button disabled during loading
- [ ] Success message appears after submission

---

## Data Validation Testing

### Input Validation
- [ ] Occupation: Required, max 255 characters
- [ ] Salary: Numeric only, non-negative
- [ ] Currency: Only valid options (PHP, USD, EUR)
- [ ] Skills: Array of strings, no duplicates
- [ ] Resume: Required, allows rich text formatting
- [ ] Date fields: Valid date format
- [ ] Message: Optional, but required when responding

### Error Handling
- [ ] Network errors show user-friendly message
- [ ] Duplicate submission prevented
- [ ] Form errors highlighted clearly
- [ ] Validation messages are helpful

---

## Performance Testing

- [ ] BusinessCatalog loads 12 items quickly
- [ ] Filter/search responds in <1 second
- [ ] Request details expand smoothly
- [ ] Modal opens/closes without lag
- [ ] Form submission completes in <3 seconds
- [ ] No console errors during interactions

---

## Accessibility Testing

- [ ] All form inputs have labels
- [ ] Radio buttons are keyboard navigable
- [ ] Buttons have focus states
- [ ] Error messages are announced
- [ ] Modal has focus management
- [ ] Colors aren't the only indicator of status

---

## Browser Compatibility

Test on:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile Chrome/Safari

---

## Cleanup and Teardown

After testing, verify database is in clean state:
```sql
-- View test data
SELECT COUNT(*) as request_count FROM business_requests;
SELECT COUNT(*) as response_count FROM business_request_responses;

-- Optional: Clean up test data
DELETE FROM business_request_responses WHERE created_at > NOW() - INTERVAL '1 hour';
DELETE FROM business_requests WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Success Criteria

All tests pass when:
1. ✅ Job seekers can submit requests to businesses
2. ✅ Business owners can view all requests for their business
3. ✅ Business owners can respond with interviews or offers
4. ✅ Request status updates correctly
5. ✅ RLS policies enforce data privacy
6. ✅ UI is responsive and user-friendly
7. ✅ No console errors or warnings
8. ✅ Performance is acceptable
9. ✅ Accessibility standards met
10. ✅ Data persists correctly in database

---

## Common Issues and Troubleshooting

### Issue: "No requests found" but data exists in DB
**Solution**: Check RLS policies are enabled and correct

### Issue: Submit button doesn't work
**Solution**: Check browser console for validation errors, ensure all required fields are filled

### Issue: Filter not working
**Solution**: Clear cache and reload, check database has requests with those statuses

### Issue: Modal doesn't appear
**Solution**: Check z-index in CSS, ensure BusinessRequestResponseModal is imported

### Issue: Responses not showing in expanded view
**Solution**: Check query in loadRequests loads responses correctly, verify database returned responses

---

## Additional Notes

- All timestamps are in UTC timezone
- Currency formatting depends on locale settings
- Business status must be 'active' to appear in catalog
- Requests can only be submitted to active businesses
- Once request is withdrawn, it cannot be reactivated
- Multiple responses to one request are allowed
