#!/usr/bin/env node
import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.VITE_PROJECT_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

async function executeSql(sql) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sql_exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({ sql })
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Response status:', response.status)
      console.error('Response body:', text)
      return { success: false, error: text }
    }

    return { success: true, data: await response.json() }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function createViewAndFunctions() {
  console.log('🔧 Creating Wallets View and Functions...\n')

  // Create the view
  console.log('1️⃣  Creating user_wallets_summary view...')
  const viewSql = `
    DROP VIEW IF EXISTS public.user_wallets_summary CASCADE;
    
    CREATE VIEW public.user_wallets_summary AS
    SELECT
      w.id,
      w.user_id,
      w.currency_code,
      c.name AS currency_name,
      c.type AS currency_type,
      c.symbol,
      c.decimals,
      w.balance,
      w.total_deposited,
      w.total_withdrawn,
      w.is_active,
      w.account_number,
      w.created_at,
      w.updated_at
    FROM public.wallets w
    INNER JOIN public.currencies c ON w.currency_code = c.code
    WHERE c.active = true AND w.is_active = true;
    
    GRANT SELECT ON public.user_wallets_summary TO anon, authenticated;
  `

  const viewResult = await executeSql(viewSql)
  if (viewResult.success) {
    console.log('✅ View created successfully\n')
  } else {
    console.warn('⚠️  View creation note:', viewResult.error?.substring(0, 100) || 'Unknown error')
    console.log('   (Continuing...)\n')
  }

  // Create the ensure_user_wallets function
  console.log('2️⃣  Creating ensure_user_wallets function...')
  const funcSql = `
    CREATE OR REPLACE FUNCTION public.ensure_user_wallets(user_id uuid)
    RETURNS void AS $$
    DECLARE
      php_exists BOOLEAN;
    BEGIN
      -- Check if user already has PHP wallet
      SELECT EXISTS(
        SELECT 1 FROM public.wallets 
        WHERE wallets.user_id = ensure_user_wallets.user_id AND currency_code = 'PHP'
      ) INTO php_exists;
      
      -- Create PHP wallet if it doesn't exist
      IF NOT php_exists THEN
        INSERT INTO public.wallets (user_id, currency_code, balance, is_active)
        VALUES (ensure_user_wallets.user_id, 'PHP', 0, true)
        ON CONFLICT (user_id, currency_code) DO NOTHING;
      END IF;
    END;
    $$ LANGUAGE plpgsql;
    
    GRANT EXECUTE ON FUNCTION public.ensure_user_wallets(uuid) TO anon, authenticated;
  `

  const funcResult = await executeSql(funcSql)
  if (funcResult.success) {
    console.log('✅ Function created successfully\n')
  } else {
    console.warn('⚠️  Function creation note:', funcResult.error?.substring(0, 100) || 'Unknown error')
    console.log('   (Continuing...)\n')
  }

  // Create the trigger function
  console.log('3️⃣  Creating trigger for auto-wallet creation...')
  const triggerSql = `
    CREATE OR REPLACE FUNCTION public.trigger_ensure_wallets()
    RETURNS TRIGGER AS $$
    BEGIN
      PERFORM public.ensure_user_wallets(NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    DROP TRIGGER IF EXISTS ensure_wallets_on_signup ON auth.users;
    
    CREATE TRIGGER ensure_wallets_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_ensure_wallets();
  `

  const triggerResult = await executeSql(triggerSql)
  if (triggerResult.success) {
    console.log('✅ Trigger created successfully\n')
  } else {
    console.warn('⚠️  Trigger creation note:', triggerResult.error?.substring(0, 100) || 'Unknown error')
    console.log('   (This may already exist)\n')
  }

  console.log('✅ Setup completed!')
  console.log('\nNote: Views and functions may require Supabase SQL Editor for creation.')
  console.log('If errors above, please create manually in Supabase SQL Editor with the SQL scripts.')
}

createViewAndFunctions().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
