# Dual Job Posting System Implementation

## Overview
This implementation adds a dual posting system to the Jobs Marketplace:
- **"Post a Job"** (service_offer): Service providers post services they can provide (logo design, lawn mowing, etc.)
- **"Looking To Hire"** (service_request): Businesses/individuals post services they need (property maintenance, haircut, house cleaning, etc.)

Both use the same `jobs` table but are segmented by a `posting_type` field.

## Features Implemented

### 1. Dual Action Buttons
- Two prominent buttons in the Jobs Marketplace header
- "Post a Job" - Opens SubmitJobModal for service providers
- "Looking To Hire" - Opens LookingToHireModal for businesses

### 2. Soft Delete Support
- Jobs are marked as deleted (soft delete) but records are preserved
- Preserves reputation history for users
- Tracking field: `deleted_at` timestamp

### 3. Reputation & History Tracking
- Public notes field for users to provide feedback
- Job completion history for building trust
- New `job_history` table for tracking completed jobs
- Users can view their job history including deleted jobs

### 4. Different Field Sets
**Post a Job (Service Offer):**
- Job title, category, description
- Hourly/fixed pay rate
- Skills required, equipment required
- Location (specific or remote)
- Business association (optional)
- Public notes

**Looking To Hire (Service Request):**
- Service needed, category, description
- Budget range (min-max)
- Timeline (flexible, urgent, soon, ongoing)
- Location (specific or remote)
- Business association (optional)
- Public notes

## Files Modified/Created

### New Files
1. **src/components/LookingToHireModal.jsx**
   - New modal for posting service requests
   - Similar structure to SubmitJobModal but with different fields
   - Includes business creation flow

2. **JOBS_TABLE_MIGRATION.sql**
   - SQL migration statements to update the jobs table
   - Adds necessary columns and indices
   - Creates job_history table
   - Creates views for filtering by posting type

3. **DUAL_JOB_POSTING_IMPLEMENTATION.md**
   - This implementation guide

### Modified Files
1. **src/components/Jobs.jsx**
   - Added LookingToHireModal import
   - Updated header buttons to show both "Post a Job" and "Looking To Hire"
   - Added state for showLookingToHireModal
   - Integrated LookingToHireModal into render

2. **src/components/SubmitJobModal.jsx**
   - Added posting_type: 'service_offer' to form submission
   - Updated location handling for remote jobs

3. **src/lib/jobsService.js**
   - Updated getActiveJobs to exclude soft-deleted jobs
   - Added softDeleteJob() method for soft deletes
   - Added getJobsByType() to filter by posting_type
   - Added getUserJobHistory() to retrieve user's job history

## Database Changes Required

Run the SQL migration from `JOBS_TABLE_MIGRATION.sql`:

```sql
-- Add new columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS posting_type VARCHAR(50) DEFAULT 'service_offer';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS public_notes TEXT DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budget_min DECIMAL(10, 2) DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budget_max DECIMAL(10, 2) DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS timeline VARCHAR(50) DEFAULT 'flexible';

-- Create indices
CREATE INDEX IF NOT EXISTS idx_jobs_posting_type ON jobs(posting_type);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_jobs_active_listing ON jobs(status, is_public, deleted_at, posting_type, created_at DESC);

-- Create job_history table
CREATE TABLE IF NOT EXISTS job_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  service_provider_id UUID NOT NULL,
  service_provider_name VARCHAR(255),
  completion_status VARCHAR(50),
  completion_date TIMESTAMP WITH TIME ZONE,
  final_amount_paid DECIMAL(10, 2),
  notes TEXT,
  public_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_history_user_id ON job_history(user_id);
CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history(job_id);
```

## How It Works

### Posting a Job (Service Offer)
1. User clicks "+ Post a Job" button
2. SubmitJobModal opens with fields for what they can do
3. User fills in service details, skills, equipment, location, and rates
4. Form is submitted with `posting_type: 'service_offer'`
5. Job is saved to database

### Looking To Hire (Service Request)
1. User clicks "+ Looking To Hire" button
2. LookingToHireModal opens with fields for what they need
3. User fills in service needed, timeline, budget, location, and notes
4. Form is submitted with `posting_type: 'service_request'`
5. Job is saved to database

### Deleting a Job
```javascript
// In your delete handler
await jobsService.softDeleteJob(jobId)
// Job is marked with deleted_at timestamp
// Record is preserved for reputation tracking
```

### Viewing Job History
```javascript
// Get all jobs (active and deleted) for a user
const history = await jobsService.getUserJobHistory(userId)
// Includes both posted jobs and completed job history
```

## Future Enhancements

1. **Reputation Scores**: Calculate scores based on completed jobs and ratings
2. **Review System**: Service providers and businesses rate each other
3. **Job Matching**: Algorithm to match service requests with service offers
4. **Messaging**: Direct chat between service requesters and providers
5. **Payment Processing**: Secure payment handling through the platform
6. **Dispute Resolution**: Handle conflicts between parties
7. **Skill Verification**: Verify service provider qualifications

## Testing Checklist

- [ ] Create a service_offer job (Post a Job)
- [ ] Create a service_request job (Looking To Hire)
- [ ] Both show up in respective marketplace views
- [ ] Soft delete a job and verify it doesn't appear in active listings
- [ ] View job history including deleted jobs
- [ ] Public notes are visible on job postings
- [ ] Remote location toggle works for both types
- [ ] Budget/rate fields work correctly
- [ ] Timeline dropdown works for service requests
- [ ] Business association works for both types

## Notes
- All existing functionality remains intact
- Backward compatibility is maintained
- Users see intuitive UI with clear distinction between the two posting types
- Reputation and history are preserved through soft deletes
