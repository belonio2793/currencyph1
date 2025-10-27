import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({
        error: "Missing Supabase environment variables",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // First, get count of current rows
    const { count: beforeCount } = await supabase
      .from("nearby_listings")
      .select("id", { count: "exact", head: true });

    console.log(`Current rows in nearby_listings: ${beforeCount}`);

    // Delete all rows
    const { error: deleteError, count: deletedCount } = await supabase
      .from("nearby_listings")
      .delete()
      .neq("id", 0); // Delete all rows (neq 0 matches all records since id > 0)

    if (deleteError) {
      throw deleteError;
    }

    console.log(`Deleted ${deletedCount} rows`);

    // Verify table is empty
    const { count: afterCount } = await supabase
      .from("nearby_listings")
      .select("id", { count: "exact", head: true });

    console.log(`Rows after deletion: ${afterCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "nearby_listings table reset successfully",
        deletedRows: deletedCount,
        rowsBefore: beforeCount,
        rowsAfter: afterCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error resetting table:", err);
    return new Response(
      JSON.stringify({
        error: (err as any).message || "Failed to reset table",
        details: String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
