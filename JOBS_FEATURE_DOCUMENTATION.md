# Jobs Marketplace Feature Documentation

## Overview

The Jobs Marketplace is a comprehensive job posting and management system integrated into the Business Management module. It enables businesses to post job opportunities and service providers to offer their services.

## Architecture

### Database Schema

The Jobs system uses 5 main tables with proper referential integrity:

#### 1. **jobs** Table
Stores main job postings with full metadata:
- `id` (UUID): Primary key
- `business_id`: Reference to business posting the job
- `posted_by_user_id`: Reference to the user who posted
- `job_title`: Job title (e.g., "Expert Hairstylist")
- `job_category`: Category (e.g., 'haircut', 'beauty', 'chef', etc.)
- `job_description`: Detailed job description
- `job_type`: 'one_time', 'hourly', 'full_time', 'part_time', 'contract'
- `pay_rate`: Compensation amount (DECIMAL 12,2)
- `pay_currency`: Currency code (default: 'PHP')
- `pay_type`: 'fixed', 'negotiable', 'hourly_rate'
- `location`, `city`, `province`: Location details
- `skills_required`: JSON array of required skills
- `experience_level`: 'entry', 'intermediate', 'expert'
- `start_date`, `end_date`: Job timeline
- `deadline_for_applications`: Application deadline
- `status`: 'active', 'filled', 'closed', 'cancelled'
- `positions_available`, `positions_filled`: Position tracking
- `is_public`: Visibility flag
- `created_at`, `updated_at`: Timestamps

#### 2. **job_offers** Table
Stores applications/offers from service providers:
- `id` (UUID): Primary key
- `job_id`: Reference to job being offered for
- `service_provider_id`: Reference to offering user
- `business_id`: Reference to receiving business
- `provider_name`, `provider_email`, `provider_phone`: Contact info
- `provider_description`: About the provider
- `offered_rate`: Provider's proposed rate
- `offer_message`: Why they want the job
- `status`: 'pending', 'accepted', 'rejected', 'completed', 'cancelled'
- `accepted_date`: When offer was accepted
- `created_at`, `updated_at`: Timestamps

#### 3. **job_ratings** Table
Stores ratings and reviews for completed jobs:
- `id` (UUID): Primary key
- `job_id`: Reference to rated job
- `job_offer_id`: Reference to specific offer (if applicable)
- `rated_by_user_id`: User giving the rating
- `rated_user_id`: User receiving the rating
- `rating_score`: 1-5 star rating
- `review_title`, `review_text`: Review content
- `rating_type`: 'quality', 'professionalism', 'communication', 'reliability'
- `created_at`, `updated_at`: Timestamps

#### 4. **job_remarks** Table
Stores comments and notes about jobs:
- `id` (UUID): Primary key
- `job_id`: Reference to job
- `job_offer_id`: Reference to offer (optional)
- `created_by_user_id`: User creating remark
- `remark_text`: Content
- `is_public`: Visibility (public remarks visible to all)
- `remark_type`: 'feedback', 'note', 'issue', 'completion_note'
- `created_at`, `updated_at`: Timestamps

#### 5. **job_history** Table
Tracks job completion and history:
- `id` (UUID): Primary key
- `job_id`: Reference to job
- `job_offer_id`: Reference to accepted offer
- `business_id`: Reference to business
- `service_provider_id`: Reference to provider
- `completion_status`: 'pending', 'in_progress', 'completed', 'cancelled'
- `completion_date`: When job was completed
- `completion_notes`: Completion details
- `final_amount_paid`: Final payment amount
- `payment_date`: Payment date
- `payment_method`: How it was paid
- `created_at`, `updated_at`: Timestamps

### Indexes

Performance indexes created for:
- `jobs.business_id`, `jobs.status`, `jobs.job_category`, `jobs.created_at`, `jobs.posted_by_user_id`
- `job_offers.job_id`, `job_offers.service_provider_id`, `job_offers.status`, `job_offers.created_at`
- `job_ratings.job_id`, `job_ratings.rated_user_id`, `job_ratings.rated_by_user_id`
- `job_remarks.job_id`, `job_remarks.is_public`, `job_remarks.created_at`
- `job_history.job_id`, `job_history.business_id`, `job_history.service_provider_id`

### Row Level Security

All tables have RLS enabled with policies for:
- Users can only view/manage their own jobs and offers
- Public jobs visible to all authenticated users
- Rating and remark visibility controls based on user role

## File Structure

```
src/
├── components/
│   ├── Jobs.jsx (Main component with tabs)
│   ├── Jobs.css
│   ├── JobCard.jsx (Individual job card display)
│   ├── JobCard.css
│   ├── JobSearch.jsx (Search with autocomplete)
│   ├── JobSearch.css
│   ├── JobDetailsModal.jsx (Full job details modal)
│   ├── JobDetailsModal.css
│   ├── PostJobModal.jsx (Create new job form)
│   ├── PostJobModal.css
│   ├── JobOfferForm.jsx (Submit offer form)
│   ├── JobOfferForm.css
│   ├── JobRatings.jsx (Ratings display)
│   ├── JobRatings.css
│   ├── JobRemarks.jsx (Comments/remarks)
│   └── JobRemarks.css
├── lib/
│   └── jobsService.js (Database operations)
└── MyBusiness.jsx (Integrated with Jobs tab)

supabase/
└── migrations/
    └── 024_create_jobs_system.sql (Database schema)
```

## Service Layer (jobsService.js)

Comprehensive API for all job-related operations:

### Jobs Operations
- `createJob(jobData)` - Post a new job
- `getActiveJobs(filters)` - Get filtered active jobs
- `getBusinessJobs(businessId)` - Get jobs posted by a business
- `getJobById(jobId)` - Get full job details with relations
- `updateJob(jobId, updates)` - Update job details
- `searchJobs(searchTerm, filters)` - Full-text search with filtering

### Job Offers Operations
- `createJobOffer(offerData)` - Submit offer for a job
- `getJobOffers(jobId)` - Get all offers for a job
- `getProviderOffers(providerId)` - Get provider's submitted offers
- `updateJobOffer(offerId, updates)` - Update offer status
- `acceptJobOffer(offerId)` - Accept an offer
- `rejectJobOffer(offerId)` - Reject an offer

### Rating Operations
- `createJobRating(ratingData)` - Create a rating/review
- `getUserRatings(userId)` - Get ratings for a user
- `getJobRatings(jobId)` - Get ratings for a job
- `getUserAverageRating(userId)` - Calculate average rating

### Remarks Operations
- `createJobRemark(remarkData)` - Add comment/remark
- `getJobRemarks(jobId, onlyPublic)` - Get remarks with visibility control

### History Operations
- `createJobHistory(historyData)` - Create completion record
- `getJobHistory(jobId)` - Get job history
- `getProviderJobHistory(providerId)` - Get provider's job history

### Analytics
- `getBusinessJobStats(businessId)` - Get job statistics
- `getJobCategories()` - Get all job categories
- `getJobCities()` - Get all job locations
- `getSearchSuggestions(searchTerm)` - Get autocomplete suggestions

## UI Components

### Jobs (Main Component)
- **Looking to Hire Tab**: Browse available jobs posted by other businesses
- **My Offers Tab**: Track job offers submitted by the user
- Job search with filters (category, city, job type, pay range)
- Statistics dashboard (active jobs, total offers, accepted, completed)
- Action buttons to post new jobs and manage applications

### JobSearch
- Real-time search with autocomplete
- Filter by:
  - Category (e.g., haircut, beauty, chef)
  - City/Location
  - Job Type (one_time, hourly, full_time, etc.)
  - Pay Range (min/max)
- Autocomplete suggestions based on existing jobs
- Clear filters button

### JobCard
- Compact job display with:
  - Job title and category
  - Status badge (active, filled, closed)
  - Job type and pay rate
  - Location
  - Offer count and rating (if available)
  - Required skills
  - Quick apply button

### JobDetailsModal
- Full job information in modal:
  - Complete description and requirements
  - Timeline (start, end, application deadline)
  - Required skills with experience level
  - Compensation details
  - Multiple tabs: Details, Offers, Ratings, Remarks
  - Submit Offer form integrated
  - View all applications (for job owner)

### PostJobModal
- Comprehensive job posting form:
  - Job details (title, category, description)
  - Type and compensation options
  - Location information
  - Skills requirements (add/remove)
  - Timeline configuration
  - Form validation and error handling

### JobOfferForm
- Service provider offer submission:
  - Provider details (name, email, phone)
  - Proposed rate comparison with job rate
  - Personal description/qualifications
  - Custom message explaining fit
  - Form validation

### JobRatings
- Display job ratings and reviews:
  - Average rating with star distribution
  - Individual review cards
  - Reviewer info and timestamps
  - Support for different rating types

### JobRemarks
- Comment/notes system:
  - Add remarks with public/private toggle
  - Display public remarks (visible to all)
  - Display private remarks (job owner only)
  - Remark type indicators
  - Timestamps on each remark

## Integration with MyBusiness

The Jobs feature is integrated as a new tab in the Business Management section:

1. Added `Jobs` import to MyBusiness.jsx
2. Added "Jobs Marketplace" tab to tab navigation
3. Added Jobs component to tab content area
4. Passes `businessId` and `currentUserId` to Jobs component

## Features

### For Businesses (Looking to Hire)
- Post jobs with detailed metadata
- Specify job type (one-time, hourly, full-time, contract, part-time)
- Set compensation and rates
- Define required skills and experience level
- Add application deadlines
- View all submitted offers
- Accept/reject offers
- Rate completed work
- Leave remarks (public and private)
- Track job completion history
- Monitor job statistics

### For Service Providers (Looking for Work)
- Browse available jobs in marketplace
- Search and filter jobs by:
  - Category
  - Location
  - Job type
  - Pay range
- View detailed job information
- Submit offers with custom rates
- Track submitted offers and their status
- View job history and completed work
- Receive ratings from businesses

### Job Management
- Full job lifecycle (active → filled → completed)
- Multiple positions per job
- Application deadline tracking
- Job status tracking
- Position filling counter

### Rating & Review System
- 5-star rating system
- Review text and titles
- Rating types (quality, professionalism, communication, reliability)
- Public average rating calculation
- Rating distribution visualization

### Remarks & Communication
- Public remarks visible to all parties
- Private remarks (job owner only)
- Multiple remark types (feedback, note, issue, completion_note)
- Timeline of all remarks

## Database Setup

1. Run the migration file:
```bash
supabase db push
# or manually execute the SQL in the Supabase dashboard
```

2. Verify tables are created:
```sql
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'job%';
```

## Usage Flow

### Posting a Job
1. Navigate to "Business Management" → "Jobs Marketplace" tab
2. Click "Post a Job"
3. Fill in job details, compensation, timeline, and requirements
4. Submit the job posting
5. Job appears immediately in the marketplace

### Applying for a Job
1. Browse jobs in "Looking to Hire" tab
2. Click on job to view details
3. Click "Apply Now" or "Submit Your Offer"
4. Fill in offer form with your rate, qualifications, and message
5. Submit the offer

### Managing Offers
1. View all offers in job details modal
2. Accept or reject individual offers
3. Leave remarks and feedback
4. Rate completed work
5. Track job history

### Search & Discovery
1. Use search bar to find jobs by keyword
2. Apply filters for precise results
3. Use autocomplete for quick navigation
4. View job statistics in dashboard

## Styling

All components use:
- Tailwind CSS for layout in parent (MyBusiness)
- Custom CSS modules for component-specific styling
- Gradient buttons and cards for visual appeal
- Responsive design (mobile-friendly)
- Color scheme matching the application theme
- Icons and status badges for quick scanning

## Performance Optimizations

1. **Lazy loading** in search with debounce (300ms)
2. **Index-based queries** for fast filtering
3. **Selective field loading** in queries
4. **RLS policies** for row-level security
5. **Pagination support** in all list views
6. **Autocomplete suggestions** limited to 8 results

## Error Handling

- Try-catch blocks in all service methods
- User-friendly error messages
- Form validation before submission
- Network error handling with retry
- Database constraint checking

## Security

1. **Row-Level Security (RLS)** on all tables
2. **User authentication** required for all operations
3. **Business ownership** validation
4. **Public/private** visibility controls
5. **Role-based access** (job owner vs service provider)
6. **No sensitive data** in logs or error messages

## Future Enhancements

Potential additions:
1. Escrow payment system
2. Contract generation
3. Time tracking for hourly jobs
4. Dispute resolution system
5. Certificate/credential verification
6. Portfolio integration
7. Recommendation engine
8. Advanced analytics dashboard
9. Scheduled job posting
10. Bulk operations

## Testing Checklist

- [ ] Create job posting
- [ ] Search jobs with various filters
- [ ] Submit job offers
- [ ] Accept/reject offers
- [ ] Leave ratings and reviews
- [ ] Add remarks (public and private)
- [ ] View job history
- [ ] Check job statistics
- [ ] Test responsive design on mobile
- [ ] Verify RLS policies work
- [ ] Test autocomplete functionality
- [ ] Validate form inputs

## Troubleshooting

**Jobs not showing up:**
- Verify migration was applied: `SELECT COUNT(*) FROM jobs;`
- Check RLS policies: `SELECT * FROM pg_policies WHERE tablename='jobs';`
- Verify business_id and user_id are correct

**Offers not saving:**
- Check job_id exists: `SELECT * FROM jobs WHERE id = 'xxx';`
- Verify service_provider_id is valid UUID
- Check RLS policies on job_offers table

**Search not working:**
- Verify jobs exist and are marked as `is_public = true`
- Check filters are correctly formatted
- Test without filters first

**Ratings not displaying:**
- Verify job was marked as completed
- Check rating_score is between 1-5
- Verify rating_by and rated_user_id are valid

## Support

For issues or questions:
1. Check browser console for errors
2. Check Supabase dashboard for RLS errors
3. Verify database schema matches migration
4. Test with sample data in Supabase dashboard
5. Review service layer error handling
