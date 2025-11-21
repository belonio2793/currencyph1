# Jobs Management System - Complete Documentation

## Overview

A comprehensive jobs and hiring management system that separates business owner functionality from job seeker functionality. Business owners can manage job positions and hiring parameters, while job seekers can browse available positions and apply directly through the platform.

## System Architecture

### Components

#### 1. **JobsManagementCard.jsx** (Business Owner View)
Displays on the business owner's own business card in the BusinessDirectory when expanded.

**Features:**
- Hiring status indicator (Actively Hiring, Limited Hiring, Not Hiring)
- Quick stats showing active positions and pending applications
- "Manage" button to open JobsManagementModal
- Visual status badges with color coding
- Salary range and experience level preview (if set)

**Props:**
```jsx
<JobsManagementCard 
  business={businessObject}      // Business data
  userId={userIdString}          // Owner's user ID
  onUpdate={callbackFunction}    // Called when data updates
/>
```

#### 2. **JobsManagementModal.jsx** (Business Owner Management)
Modal interface for business owners to configure hiring and manage job positions.

**Two Main Tabs:**

**Tab 1: Hiring Overview**
- Set hiring status (Actively Hiring, Limited Hiring, Not Hiring)
- Define positions available
- Set salary range (min/max)
- Specify required experience level
- Set hiring timeline
- Add benefits/perks description
- Save hiring parameters to business metadata

**Tab 2: Job Positions**
- View all active job postings
- Create new job positions with:
  - Job title (required)
  - Job category
  - Job description
  - Job type (Full-time, Part-time, Contract, Temporary)
  - Pay rate
  - Number of positions available
  - Experience level
  - Application deadline
- Delete job positions
- View applicant count per job

**Data Storage:**
- Hiring parameters → `businesses.metadata` (JSON field)
- Individual jobs → `jobs` table

#### 3. **JobsJobSeekerDisplay.jsx** (Job Seeker View)
Displays on business cards for job seekers viewing other businesses.

**Features:**
- Hiring status banner with color-coded indicator
- Quick hiring information grid:
  - Salary range
  - Experience level
  - Hiring timeline
- Benefits/perks section (if provided by employer)
- List of available positions with:
  - Job title and category
  - Pay rate
  - Positions available
  - Application deadline
  - Expandable details showing full description
  - Required skills
  - Requirements checklist
- Apply button that opens application form
- Application form with:
  - Cover letter/message
  - Availability date
  - Form submission

**Data Retrieval:**
- Hiring parameters from `businesses.metadata`
- Jobs from `jobs` table (filtered for active, public jobs)
- Applicant info from `job_offers` table

#### 4. **JobsManagementCard.css** & **JobsManagementModal.css** & **JobsJobSeekerDisplay.css**
Comprehensive styling for all components with:
- Responsive design for mobile/tablet/desktop
- Color-coded status indicators
- Form layouts and validations
- Modal animations
- Button styles and interactions
- Grid layouts for information display

### Integration Points

#### BusinessDirectory.jsx
The Jobs components are integrated into the expanded card view:

```jsx
{/* Jobs Section - Different for owners vs job seekers */}
{owner ? (
  <JobsManagementCard 
    business={business} 
    userId={userId}
    onUpdate={loadBusinesses}
  />
) : (
  <JobsJobSeekerDisplay 
    business={business} 
    userId={userId}
  />
)}
```

This means:
- When a business owner views their own business card (expanded), they see JobsManagementCard
- When a job seeker views a business card (expanded), they see JobsJobSeekerDisplay

## Database Schema

### Businesses Table (Existing)
```sql
-- Jobs-related metadata fields
metadata JSONB {
  hiring_status: 'actively_hiring' | 'limited_hiring' | 'not_hiring',
  positions_available: number,
  salary_range_min: number,
  salary_range_max: number,
  experience_level: 'any' | 'entry' | 'mid' | 'senior' | 'executive',
  job_types: array<string>,
  required_skills: array<string>,
  hiring_timeline: string,
  benefits: string,
  hiring_parameters_updated_at: timestamp
}
```

### Jobs Table (Existing)
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  posted_by_user_id UUID REFERENCES auth.users(id),
  job_title VARCHAR(255) NOT NULL,
  job_category VARCHAR(100),
  job_description TEXT,
  job_type VARCHAR(50),  -- 'full_time', 'part_time', 'contract', 'temporary'
  pay_rate DECIMAL(12, 2),
  pay_currency VARCHAR(10) DEFAULT 'PHP',
  pay_type VARCHAR(50),
  city VARCHAR(100),
  location VARCHAR(255),
  skills_required JSONB,  -- Array of skills
  experience_level VARCHAR(50),
  positions_available INTEGER DEFAULT 1,
  positions_filled INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  deadline_for_applications DATE,
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'inactive', 'deleted'
  is_public BOOLEAN DEFAULT true,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Job Offers Table (Existing)
```sql
CREATE TABLE job_offers (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  business_id UUID REFERENCES businesses(id),
  service_provider_id UUID REFERENCES auth.users(id),
  status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'accepted', 'rejected'
  offer_message TEXT,
  metadata JSONB {
    availability: string,
    applied_at: timestamp
  },
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## User Workflows

### Workflow 1: Business Owner Setting Up Hiring
1. Owner navigates to Jobs page → Businesses tab
2. Owner finds their own business in the directory
3. Owner clicks to expand their business card
4. Owner sees JobsManagementCard
5. Owner clicks "Manage" or "View & Manage Jobs"
6. JobsManagementModal opens
7. Owner sets hiring parameters (status, salary range, timeline, benefits)
8. Owner clicks "Save Hiring Parameters"
9. Owner navigates to "Job Positions" tab
10. Owner clicks "+ Create New Position"
11. Owner fills in job details (title, description, requirements, etc.)
12. Owner clicks "Create Position"
13. Job is now live and visible to job seekers

### Workflow 2: Job Seeker Browsing Positions
1. Job seeker navigates to Jobs page → Businesses tab
2. Job seeker browses businesses or searches
3. Job seeker clicks to expand a business card
4. Job seeker sees JobsJobSeekerDisplay showing:
   - Hiring status (Actively Hiring, Limited Hiring, or Not Hiring)
   - Salary range, experience level, timeline
   - Available positions list
5. Job seeker clicks on a position to see full details
6. Job seeker clicks "Apply for This Position"
7. Application form opens
8. Job seeker enters cover letter and availability
9. Job seeker clicks "Submit Application"
10. Application is recorded in job_offers table
11. Job seeker sees success message

### Workflow 3: Viewing Applications (Future Enhancement)
1. Business owner goes to business management
2. Owner sees "Pending Requests" stat
3. Owner can click to view all applications for their jobs
4. Owner can accept or reject applications
5. Accepted applicants can be converted to employees

## Technical Details

### Service Integration
Uses `jobsService` from `src/lib/jobsService.js`:
- `getBusinessJobs(businessId)` - Fetch all jobs for a business
- `createJob(jobData)` - Create new job posting
- `updateJob(jobId, updates)` - Update job details
- `softDeleteJob(jobId)` - Mark job as deleted

### State Management
- React hooks (useState, useEffect)
- Supabase direct queries for reading
- Service methods for writing

### Error Handling
- Try-catch blocks for all async operations
- User-friendly error messages
- Success notifications
- Loading states

### Security
- Row-level security (RLS) on all tables
- User ownership verification
- Authorization checks for sensitive operations
- Data validation on forms

## Styling & UX

### Color Coding
- **Actively Hiring**: 🟢 Green (#10b981)
- **Limited Hiring**: 🟡 Amber (#f59e0b)
- **Not Hiring**: 🔴 Red (#ef4444)

### Responsive Design
- Mobile-first approach
- Breakpoints at 640px, 768px
- Touch-friendly buttons (minimum 44px)
- Flexible grid layouts
- Readable font sizes on all devices

### Components Pattern
All components follow:
- Consistent padding/margins (8px, 12px, 16px, 20px)
- Unified color scheme
- Standard button styles
- Consistent form input styling
- Modal overlay implementation

## Features Summary

### For Business Owners
✅ Set hiring status and parameters
✅ Define salary ranges
✅ Specify experience level requirements
✅ Create/manage multiple job positions
✅ View application statistics
✅ Delete job postings
✅ Add benefits information
✅ Set hiring timeline

### For Job Seekers
✅ Browse all businesses
✅ See hiring status at a glance
✅ View salary ranges
✅ Browse available positions
✅ Read full job descriptions
✅ See required skills
✅ Apply directly for positions
✅ Submit custom messages with applications

## Future Enhancements

1. **Advanced Filtering**: Filter jobs by salary, experience, type
2. **Job Search**: Search across all jobs globally
3. **Application Tracking**: Dashboard for job seekers to track applications
4. **Email Notifications**: Notify owners of new applications
5. **Interview Scheduling**: Schedule interviews within platform
6. **Skill Matching**: Match job seeker skills to positions
7. **Ratings & Reviews**: Rate employers and jobs
8. **Job Analytics**: View job posting performance metrics
9. **Bulk Job Upload**: Import multiple jobs from CSV
10. **Job Templates**: Save job description templates

## Troubleshooting

### Issue: Jobs not loading
**Solution**: 
- Check Supabase connection
- Verify jobs table exists
- Check if business_id is correct
- Review browser console for errors

### Issue: Application submission fails
**Solution**:
- Verify user is logged in
- Check network connection
- Ensure job_offers table exists
- Verify form validation passing

### Issue: Hiring parameters not saving
**Solution**:
- Check user has permission to edit business
- Verify business metadata field is JSON type
- Check Supabase RLS policies
- Review browser console errors

### Issue: Modal not opening
**Solution**:
- Check z-index values in CSS
- Verify no JavaScript errors
- Check modal-overlay visibility
- Test in different browser

## API Integration

### Creating a Job
```javascript
const newJob = await jobsService.createJob({
  business_id: businessId,
  posted_by_user_id: userId,
  job_title: 'Senior Developer',
  job_category: 'IT',
  job_description: 'Looking for experienced developers...',
  job_type: 'full_time',
  pay_rate: 80000,
  pay_currency: 'PHP',
  experience_level: 'senior',
  positions_available: 2,
  skills_required: ['React', 'Node.js', 'PostgreSQL'],
  status: 'active',
  is_public: true,
  city: 'Manila'
})
```

### Applying for a Job
```javascript
const application = await supabase
  .from('job_offers')
  .insert({
    job_id: jobId,
    business_id: businessId,
    service_provider_id: userId,
    status: 'pending',
    offer_message: 'I am very interested...',
    metadata: {
      availability: 'Immediately',
      applied_at: new Date().toISOString()
    }
  })
```

### Updating Hiring Parameters
```javascript
await supabase
  .from('businesses')
  .update({
    metadata: {
      ...business.metadata,
      hiring_status: 'actively_hiring',
      positions_available: 5,
      salary_range_min: 30000,
      salary_range_max: 80000
    }
  })
  .eq('id', businessId)
  .eq('user_id', userId)
```

## Testing Checklist

- [ ] Business owner can save hiring parameters
- [ ] Jobs are created successfully
- [ ] Job seekers can view hiring status
- [ ] Job seekers can expand job details
- [ ] Job seekers can submit applications
- [ ] Applications appear in job_offers table
- [ ] Error messages display appropriately
- [ ] Modal opens and closes properly
- [ ] Form validation works
- [ ] Responsive design on mobile
- [ ] Page loads quickly
- [ ] No console errors

## Support & Maintenance

For issues or questions:
1. Check browser console for errors
2. Verify Supabase database connectivity
3. Check database table structure
4. Review RLS policies
5. Check user permissions
6. Review application logs

---

**Version**: 1.0
**Status**: Production Ready
**Last Updated**: [Current Date]
