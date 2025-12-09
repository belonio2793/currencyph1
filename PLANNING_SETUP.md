# Planning Group Chat Setup

## Step 1: Create Tables in Supabase

Go to your Supabase dashboard and run the following SQL in the SQL Editor:

```sql
-- Create planning_users table
CREATE TABLE IF NOT EXISTS planning_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'pending',
  joined_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create planning_messages table
CREATE TABLE IF NOT EXISTS planning_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  planning_user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (planning_user_id) REFERENCES planning_users(id) ON DELETE CASCADE
);

-- Create planning_markers table
CREATE TABLE IF NOT EXISTS planning_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  marker_type TEXT DEFAULT 'facility',
  status TEXT DEFAULT 'planned',
  details JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (created_by) REFERENCES planning_users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_planning_messages_user ON planning_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_planning_messages_created ON planning_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planning_users_status ON planning_users(status);
CREATE INDEX IF NOT EXISTS idx_planning_markers_type ON planning_markers(marker_type);

-- Enable RLS
ALTER TABLE planning_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_markers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for planning_users
CREATE POLICY "planning_users_can_view_all" ON planning_users FOR SELECT USING (true);
CREATE POLICY "planning_users_can_insert_own" ON planning_users FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "planning_users_can_update_own" ON planning_users FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RLS Policies for planning_messages
CREATE POLICY "planning_messages_can_view_all" ON planning_messages FOR SELECT USING (true);
CREATE POLICY "planning_messages_can_insert_own" ON planning_messages FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for planning_markers
CREATE POLICY "planning_markers_can_view_all" ON planning_markers FOR SELECT USING (true);
CREATE POLICY "planning_markers_can_insert_own" ON planning_markers FOR INSERT WITH CHECK (
  created_by IN (SELECT id FROM planning_users WHERE user_id = auth.uid())
);
CREATE POLICY "planning_markers_can_update_own" ON planning_markers FOR UPDATE USING (
  created_by IN (SELECT id FROM planning_users WHERE user_id = auth.uid())
);
```

## Step 2: Access the Planning Page

The planning page is now accessible at `/planning` and provides:

- **Sign In / Register**: Authentication specific to planning members
- **Interactive Map**: Markers for facilities, equipment distribution, processing units
- **Chat Interface**: Real-time discussion about:
  - Manufacturing setup
  - Facilities and equipment
  - Processing and installation
  - Revenue calculations
  - Partner/vendor outreach
  - Product sourcing (mangoes, coconuts)
- **Online User Counter**: See active members
- **Message History**: Persistent chat records with role-based access

## Roles

- **member**: Standard planning participant
- **admin**: Can manage markers and approve new members (pending->member transition)

## Status

- **pending**: Awaiting admin approval
- **active**: Full access to planning resources
- **suspended**: Temporarily restricted

## Marker Types

- **facility**: Processing or manufacturing facility
- **distribution**: Equipment/product distribution point
- **storage**: Storage facility
- **shipping**: Shipping/logistics point
- **vendor**: Partner vendor location
