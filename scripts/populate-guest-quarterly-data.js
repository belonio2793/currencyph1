import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://corcofbmafdxehvlbesx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvcmNvZmJtYWZkeGVodmxiZXN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTQ0Mjk2NiwiZXhwIjoyMDc3MDE4OTY2fQ.zKQaZcsCXmVMr4uExjJzuV07H3JlEJP65f2_SKrpcb4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateQuarterlyData() {
  try {
    // Find guest user
    const { data: users } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'guest@currency.ph')
      .single();

    if (!users) {
      console.log('Guest user not found');
      return;
    }

    console.log('Found guest user:', users.id);

    // Find their business
    let { data: businesses } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', users.id);

    let business = businesses && businesses.length > 0 ? businesses[0] : null;

    if (!business) {
      console.log('No business found for guest user, creating one...');
      const { data: newBusiness, error: createError } = await supabase
        .from('businesses')
        .insert({
          user_id: users.id,
          business_name: 'Currency.ph',
          business_type: 'retail',
          registration_type: 'sole_proprietor',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      business = newBusiness;
      console.log('Created new business:', business.id);
    }

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

    const receiptsToInsert = testReceipts.map(r => ({
      business_id: business.id,
      amount: r.amount,
      description: `Test receipt - ₱${r.amount}`,
      created_at: r.created_at,
      updated_at: r.created_at
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
      { amount: 100, created_at: '2025-01-10T10:00:00Z', category: 'supplies' },
      { amount: 150, created_at: '2025-02-15T10:00:00Z', category: 'utilities' },
      { amount: 80, created_at: '2025-03-18T10:00:00Z', category: 'rent' },
      // Q2 (Apr-Jun)
      { amount: 200, created_at: '2025-04-08T10:00:00Z', category: 'supplies' },
      { amount: 180, created_at: '2025-05-12T10:00:00Z', category: 'utilities' },
      { amount: 150, created_at: '2025-06-20T10:00:00Z', category: 'rent' },
      // Q3 (Jul-Sep)
      { amount: 220, created_at: '2025-07-14T10:00:00Z', category: 'supplies' },
      { amount: 200, created_at: '2025-08-16T10:00:00Z', category: 'utilities' },
      { amount: 180, created_at: '2025-09-22T10:00:00Z', category: 'rent' },
      // Q4 (Oct-Dec)
      { amount: 250, created_at: '2025-10-12T10:00:00Z', category: 'supplies' },
      { amount: 230, created_at: '2025-11-18T10:00:00Z', category: 'utilities' },
      { amount: 200, created_at: '2025-12-20T10:00:00Z', category: 'rent' }
    ];

    const expensesToInsert = testExpenses.map(e => ({
      business_id: business.id,
      amount: e.amount,
      description: `Test expense - ₱${e.amount} (${e.category})`,
      category: e.category,
      created_at: e.created_at,
      updated_at: e.created_at
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
