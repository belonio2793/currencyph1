import React, { useState } from 'react'

export default function PlanningSetup() {
  const [copied, setCopied] = useState(false)

  const sqlCode = `-- Create planning_users table
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
);`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Planning Tables Setup</h1>
          <p className="text-slate-400">Run this SQL in your Supabase SQL Editor to set up the planning group tables</p>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="bg-slate-700 px-6 py-4 flex items-center justify-between border-b border-slate-600">
            <span className="text-white font-mono text-sm">setup-planning.sql</span>
            <button
              onClick={copyToClipboard}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy SQL'}
            </button>
          </div>

          <pre className="p-6 overflow-x-auto">
            <code className="text-slate-300 font-mono text-sm leading-relaxed whitespace-pre">
              {sqlCode}
            </code>
          </pre>
        </div>

        <div className="mt-8 bg-blue-900 border border-blue-700 rounded-lg p-6">
          <h2 className="text-white font-semibold mb-3">Instructions:</h2>
          <ol className="text-blue-100 space-y-2 list-decimal list-inside">
            <li>Click "Copy SQL" above</li>
            <li>Go to your Supabase Dashboard → SQL Editor</li>
            <li>Create a new query and paste the SQL</li>
            <li>Click "Run" to execute the query</li>
            <li>Once complete, the Planning page will be fully functional</li>
          </ol>
        </div>

        <div className="mt-8 bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-white font-semibold mb-3">What This Creates:</h2>
          <ul className="text-slate-400 space-y-2 list-disc list-inside">
            <li><code className="bg-slate-900 px-2 py-1 rounded text-slate-300">planning_users</code> - Manages planning group members (pending/active status)</li>
            <li><code className="bg-slate-900 px-2 py-1 rounded text-slate-300">planning_messages</code> - Chat history and discussions</li>
            <li><code className="bg-slate-900 px-2 py-1 rounded text-slate-300">planning_markers</code> - Map markers for facilities, distribution centers, storage</li>
            <li>Indexes for performance optimization</li>
            <li>Row-Level Security (RLS) policies for data protection</li>
          </ul>
        </div>

        <div className="mt-8">
          <button
            onClick={() => window.location.href = '/coconuts'}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            ← Back to Coconuts
          </button>
        </div>
      </div>
    </div>
  )
}
