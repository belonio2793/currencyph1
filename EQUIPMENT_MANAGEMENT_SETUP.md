# Equipment Management System Setup Guide

## Overview

A comprehensive equipment management system has been implemented with:
- ✅ **Pagination** - View one equipment per page with navigation controls
- ✅ **Comprehensive Form Fields** - All equipment specs including measurements and costs
- ✅ **Image Management** - Upload and view clickable image previews for each equipment
- ✅ **AI Bulk Import** - Use Grok AI to parse and extract structured equipment data from text
- ✅ **Database Persistence** - All data saved to SQL with proper schema

## Components & Files

### 1. New Components
- **`src/components/EquipmentManager.jsx`** - Enhanced equipment management UI with:
  - Pagination through equipment items
  - All database fields mapped to form inputs
  - Image upload with preview functionality
  - AI-powered bulk data parsing using Grok API
  - Measurement inputs for dimensions and weight
  - Cost and timeline fields

### 2. Updated Components
- **`src/components/Investments.jsx`** - Modified equipment tab to:
  - Launch EquipmentManager in a modal
  - Display equipment in a clean summary table
  - Show total equipment costs
  - Display supplier information

### 3. Database Migration
- **`supabase/migrations/034_add_equipment_images.sql`** - Creates:
  - `equipment_images` table for storing equipment photos
  - Proper indexing and RLS policies

### 4. Migration Script
- **`scripts/apply-migration-034.js`** - Applies the migration (requires manual execution in Supabase)

## Setup Instructions

### Step 1: Apply the Database Migration

Run the migration SQL manually:

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/034_add_equipment_images.sql`
5. Click **Run** to execute

The migration creates:
- `equipment_images` table with columns for image storage and metadata
- Indexes for efficient querying
- Row-level security (RLS) policies

### Step 2: Configure Storage Bucket

Create a storage bucket for equipment images:

1. In Supabase Dashboard, go to **Storage**
2. Click **New Bucket**
3. Name it: `equipment-images`
4. Make it **Public** (for image access)
5. Click **Create Bucket**

Optional: Set up a lifecycle policy to auto-delete images after 30 days if needed.

### Step 3: Test the Feature

1. Navigate to the **Investments** section in your app
2. Click on a project to view details
3. Go to the **Equipment** tab
4. Click **⚙️ Manage Equipment** button

### Step 4: Add Equipment (Methods)

#### Method A: Add Manually
1. Click **+ Add Equipment** button
2. Fill in the form fields:
   - **Basic Information**: Name, Type, Quantity, Material
   - **Capacity & Performance**: Capacity value/unit, Power consumption, Efficiency
   - **Measurements**: Length, Width, Height (in mm), Weight (in kg)
   - **Costs & Timeline**: Unit cost (USD), Installation cost, Lead time, Lifespan
   - **Notes**: Additional information
3. Click **Save Equipment**
4. Upload photos by clicking the upload area

#### Method B: Bulk Import with AI
1. Click **📋 Bulk Import (AI)** button
2. Paste equipment data in any format, for example:
   ```
   washing machine, stainless steel, 10 L capacity, 1.5 kW, $500, 30 days lead time, 5 years lifespan
   grinding machine, aluminum, 5 kg/h capacity, 2.2 kW, $1000, weight 50 kg
   centrifuge, SUS 304, 20 L/h capacity, 3 kW power, installation 15 days, $2000
   ```
3. Click **Parse with AI**
4. The Grok AI will extract structured data and create equipment entries
5. Review and save the parsed items

## Database Schema

### project_equipment table (existing)
```sql
- id BIGSERIAL PRIMARY KEY
- project_id BIGINT
- supplier_id BIGINT
- equipment_name VARCHAR(255) [Required]
- equipment_type VARCHAR(50)
- quantity INT DEFAULT 1
- unit_cost_usd DECIMAL(12,2) [Required]
- total_cost_usd DECIMAL(15,2) [Generated]
- capacity_value DECIMAL(12,2)
- capacity_unit VARCHAR(50) (L, kg, T, L/h, kg/h, etc.)
- power_consumption_kw DECIMAL(8,2)
- material_of_construction VARCHAR(100)
- length_mm INT
- width_mm INT
- height_mm INT
- weight_kg DECIMAL(10,2)
- installation_days INT
- installation_cost_usd DECIMAL(12,2)
- lead_time_days INT
- expected_lifespan_years INT
- maintenance_cost_annual_usd DECIMAL(10,2)
- expected_efficiency_percentage DECIMAL(5,2)
- notes TEXT
- created_at TIMESTAMP
- updated_at TIMESTAMP
```

### equipment_images table (new)
```sql
- id BIGSERIAL PRIMARY KEY
- project_id BIGINT [Required]
- equipment_id BIGINT [Required]
- image_url TEXT [Required]
- storage_path VARCHAR(500)
- alt_text VARCHAR(255)
- is_primary BOOLEAN DEFAULT FALSE
- display_order INT DEFAULT 0
- file_size INT
- mime_type VARCHAR(50)
- created_at TIMESTAMP
- updated_at TIMESTAMP
```

## Features in Detail

### Pagination
- Navigate between equipment items using Previous/Next buttons
- Current position shown (e.g., "Item 1 of 5")
- Disabled when at start or end of list

### Form Fields
All fields from the database schema are mapped to inputs:
- Text inputs for equipment name, type, material
- Number inputs for capacity, power, dimensions, weight
- Currency input for costs (with PHP/USD conversion)
- Date/timeline inputs for installation and lead time
- Efficiency percentage field

### Image Management
- Drag-and-drop or click to upload images
- Multiple images per equipment supported
- Click image to enlarge preview
- Hover to delete images
- Auto-saves to Supabase storage bucket
- Stores image metadata in database

### AI Bulk Import
- Uses X_API key (Grok) to parse equipment data
- Accepts free-text input in any format
- Extracts:
  - Equipment name (required)
  - Type, capacity, dimensions
  - Power consumption, efficiency
  - Costs, installation time, lifespan
  - Notes and additional details
- Creates multiple equipment items from one text input
- Returns JSON-parsed results for review

### Cost Calculations
- Unit Cost × Quantity = Total Cost (automatically displayed)
- Installation costs tracked separately
- Annual maintenance costs captured
- All costs stored in USD in database
- PHP conversion shown in UI (if using CurrencyInput component)

## API Integration

### Grok API for Bulk Import
- Endpoint: `https://api.x.ai/chat/completions`
- Model: `grok-2`
- Uses environment variable: `VITE_X_API_KEY`
- Temperature: 0.3 (low) for consistent parsing
- Max tokens: 4096

### Database Operations
All operations use Supabase client:
```javascript
// Load equipment
supabase.from('project_equipment').select('*').eq('project_id', projectId)

// Save equipment
supabase.from('project_equipment').insert([...])
supabase.from('project_equipment').update(...)

// Image operations
supabase.storage.from('equipment-images').upload(path, file)
supabase.from('equipment_images').insert([...])
```

## Troubleshooting

### Images Not Uploading
- Ensure `equipment-images` storage bucket exists and is public
- Check browser console for errors
- Verify equipment is saved before uploading images
- Check file size (large files may timeout)

### AI Parsing Not Working
- Verify X_API_KEY is set in environment variables
- Check API rate limits (Grok API has rate limits)
- Try with simpler text format
- Check browser console for API response errors

### Fields Not Saving
- Ensure all required fields are filled (equipment_name)
- Check database connection
- Verify user has permission to write to project_equipment table
- Check browser console for validation errors

### Storage Bucket Not Found
- Create `equipment-images` bucket in Supabase Storage
- Make it public (Policy: Public)
- Test with a sample file upload

## Environment Variables Required

```env
VITE_X_API_KEY=xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3
VITE_PROJECT_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Performance Notes

- Pagination loads one item at a time
- Images stored in Supabase Storage (separate from database)
- Database queries indexed by project_id and equipment_id
- AI parsing happens client-side, no server calls needed
- RLS policies ensure users can only see their project equipment

## Future Enhancements

Potential improvements:
- Drag-and-drop reordering of equipment items
- Equipment templates for common items
- Cost estimation based on capacity
- Supplier linking and quotes
- Equipment history and change tracking
- Export to PDF or Excel
- Barcode/QR code generation
- Integration with procurement systems
