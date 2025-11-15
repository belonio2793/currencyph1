import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://corcofbmafdxehvlbesx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateQuarterlyData() {
  try {
    // Find any business (the guest user likely created one through the UI)
    const { data: allBusinesses } = await supabase
      .from('businesses')
      .select('*')
      .limit(1);

    if (!allBusinesses || allBusinesses.length === 0) {
      console.log('No businesses found in the system');
      console.log('Please create a business in the app first using "Add Business" button');
      return;
    }

    const business = allBusinesses[0];
    console.log('Using business:', business.id, '-', business.business_name);

    console.log('Found business:', business.id);

    // Delete existing test data
    await supabase
      .from('business_receipts')
      .delete()
      .eq('business_id', business.id);

    await supabase
      .from('miscellaneous_costs')
      .delete()
      .eq('business_id', business.id);

    console.log('Cleared existing data');

    // First get a guest user from auth (we need a user_id for receipts)
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
    const guestAuthUser = authUsers?.find(u => u.email === 'guest@currency.ph');
    const userId = guestAuthUser?.id || business.user_id;

    if (!userId) {
      console.log('Warning: Could not determine user_id. Using business.user_id');
    }

    // Create test receipts across quarters
    const testReceipts = [
      // Q1 (Jan-Mar)
      { amount: 500, created_at: '2025-01-15T10:00:00Z' },
      { amount: 750, created_at: '2025-02-10T10:00:00Z' },
      { amount: 600, created_at: '2025-03-20T10:00:00Z' },
      // Q2 (Apr-Jun)
      { amount: 800, created_at: '2025-04-05T10:00:00Z' },
      { amount: 900, created_at: '2025-05-15T10:00:00Z' },
      { amount: 700, created_at: '2025-06-25T10:00:00Z' },
      // Q3 (Jul-Sep)
      { amount: 1000, created_at: '2025-07-10T10:00:00Z' },
      { amount: 1100, created_at: '2025-08-12T10:00:00Z' },
      { amount: 950, created_at: '2025-09-18T10:00:00Z' },
      // Q4 (Oct-Dec)
      { amount: 1200, created_at: '2025-10-08T10:00:00Z' },
      { amount: 1150, created_at: '2025-11-14T10:00:00Z' },
      { amount: 1300, created_at: '2025-12-22T10:00:00Z' }
    ];

    const receiptsToInsert = testReceipts.map((r, idx) => ({
      business_id: business.id,
      user_id: userId || business.user_id,
      receipt_number: `RCP-Q${Math.ceil((idx + 1) / 3)}-${idx + 1}`,
      customer_name: `Customer ${idx + 1}`,
      customer_email: null,
      customer_phone: null,
      amount: r.amount,
      payment_method: 'Cash',
      items: [],
      notes: `Test receipt for quarterly reporting`,
      status: 'completed',
      created_at: r.created_at
    }));

    const { data: insertedReceipts, error: receiptsError } = await supabase
      .from('business_receipts')
      .insert(receiptsToInsert)
      .select();

    if (receiptsError) throw receiptsError;
    console.log(`Inserted ${insertedReceipts.length} test receipts`);

    // Create test expenses across quarters
    const testExpenses = [
      // Q1 (Jan-Mar)
      { amount: 100, cost_date: '2025-01-10', category: 'supplies' },
      { amount: 150, cost_date: '2025-02-15', category: 'utilities' },
      { amount: 80, cost_date: '2025-03-18', category: 'rent' },
      // Q2 (Apr-Jun)
      { amount: 200, cost_date: '2025-04-08', category: 'supplies' },
      { amount: 180, cost_date: '2025-05-12', category: 'utilities' },
      { amount: 150, cost_date: '2025-06-20', category: 'rent' },
      // Q3 (Jul-Sep)
      { amount: 220, cost_date: '2025-07-14', category: 'supplies' },
      { amount: 200, cost_date: '2025-08-16', category: 'utilities' },
      { amount: 180, cost_date: '2025-09-22', category: 'rent' },
      // Q4 (Oct-Dec)
      { amount: 250, cost_date: '2025-10-12', category: 'supplies' },
      { amount: 230, cost_date: '2025-11-18', category: 'utilities' },
      { amount: 200, cost_date: '2025-12-20', category: 'rent' }
    ];

    const expensesToInsert = testExpenses.map((e, idx) => ({
      business_id: business.id,
      user_id: userId || business.user_id,
      description: `Test ${e.category} expense - ₱${e.amount}`,
      amount: e.amount,
      category: e.category,
      cost_date: e.cost_date,
      payment_method: 'Cash',
      notes: `Test expense for quarterly reporting`,
      status: 'recorded'
    }));

    const { data: insertedExpenses, error: expensesError } = await supabase
      .from('miscellaneous_costs')
      .insert(expensesToInsert)
      .select();

    if (expensesError) throw expensesError;
    console.log(`Inserted ${insertedExpenses.length} test expenses`);

    console.log('\n✅ Quarterly test data populated successfully!');
    console.log('\nSummary:');
    console.log('- Q1: ₱1,850 sales, ₱330 expenses = ₱1,520 net');
    console.log('- Q2: ₱2,400 sales, ₱530 expenses = ₱1,870 net');
    console.log('- Q3: ₱3,050 sales, ₱600 expenses = ₱2,450 net');
    console.log('- Q4: ₱3,650 sales, ₱680 expenses = ₱2,970 net');

  } catch (error) {
    console.error('Error populating data:', error.message);
    process.exit(1);
  }
}

populateQuarterlyData();
