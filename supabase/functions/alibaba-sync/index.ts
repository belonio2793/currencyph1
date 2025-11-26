import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AlibabaSyncRequest {
  action: "sync" | "manual" | "queue-sync" | "get-status";
  syncType?: "full" | "incremental" | "manual";
  alibabaProductIds?: string[];
  businessId?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = (await req.json()) as AlibabaSyncRequest;

    // Route to appropriate handler
    switch (body.action) {
      case "sync":
        return await handleSync(
          supabase,
          body.syncType || "full",
          body.businessId
        );

      case "manual":
        return await handleManualSync(
          supabase,
          body.alibabaProductIds || [],
          body.businessId
        );

      case "queue-sync":
        return await handleQueueSync(supabase, body.alibabaProductIds || []);

      case "get-status":
        return await handleGetStatus(supabase);

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Alibaba sync error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/**
 * Handle full or incremental sync from Alibaba
 */
async function handleSync(
  supabase: any,
  syncType: "full" | "incremental",
  businessId?: string
) {
  // Create sync log entry
  const { data: syncLog, error: syncLogError } = await supabase
    .from("alibaba_sync_log")
    .insert({
      sync_type: syncType,
      status: "in_progress",
    })
    .select()
    .single();

  if (syncLogError) {
    throw new Error(`Failed to create sync log: ${syncLogError.message}`);
  }

  try {
    // Get Alibaba config
    const { data: config, error: configError } = await supabase
      .from("alibaba_config")
      .select("*")
      .single();

    if (configError || !config?.app_id) {
      throw new Error("Alibaba not configured. Please add API credentials.");
    }

    // Get business (if not specified, use first business)
    const { data: business } = await supabase
      .from("businesses")
      .select("id, user_id")
      .eq("id", businessId || "")
      .limit(1)
      .single();

    if (!business) {
      throw new Error("No business found. Please set up a business first.");
    }

    // TODO: Call Alibaba API here when API keys are available
    // For now, we'll prepare the infrastructure
    console.log("Alibaba sync prepared for:", {
      syncType,
      businessId: business.id,
      sellerId: business.user_id,
    });

    // Simulate sync queue
    const queueItems = [];
    // const alibabaProducts = await callAlibabaAPI(config, syncType);

    // Queue products for processing
    // for (const product of alibabaProducts) {
    //   queueItems.push({
    //     status: 'pending',
    //     sync_type: syncType,
    //     alibaba_product_id: product.id,
    //     metadata: { businessId: business.id, sellerId: business.user_id }
    //   });
    // }

    // Insert queue items
    if (queueItems.length > 0) {
      const { error: queueError } = await supabase
        .from("alibaba_sync_queue")
        .insert(queueItems);

      if (queueError) {
        throw new Error(`Failed to queue products: ${queueError.message}`);
      }
    }

    // Update sync log
    await supabase
      .from("alibaba_sync_log")
      .update({
        status: "completed",
        end_time: new Date().toISOString(),
        products_imported: queueItems.length,
      })
      .eq("id", syncLog.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${syncType} sync queued for ${queueItems.length} products`,
        syncLogId: syncLog.id,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Update sync log with error
    await supabase
      .from("alibaba_sync_log")
      .update({
        status: "failed",
        end_time: new Date().toISOString(),
        error_message:
          error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", syncLog.id);

    throw error;
  }
}

/**
 * Handle manual sync of specific products
 */
async function handleManualSync(
  supabase: any,
  alibabaProductIds: string[],
  businessId?: string
) {
  if (alibabaProductIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "No product IDs provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, user_id")
    .eq("id", businessId || "")
    .limit(1)
    .single();

  if (!business) {
    return new Response(
      JSON.stringify({ error: "Business not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Queue specific products
  const queueItems = alibabaProductIds.map((productId) => ({
    status: "pending",
    sync_type: "manual",
    alibaba_product_id: productId,
    priority: 10,
    metadata: { businessId: business.id, sellerId: business.user_id },
  }));

  const { error } = await supabase
    .from("alibaba_sync_queue")
    .insert(queueItems);

  if (error) {
    throw new Error(`Failed to queue products: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Queued ${queueItems.length} products for manual sync`,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Add products to sync queue
 */
async function handleQueueSync(
  supabase: any,
  alibabaProductIds: string[]
) {
  if (alibabaProductIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "No product IDs provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const queueItems = alibabaProductIds.map((productId) => ({
    status: "pending",
    sync_type: "incremental",
    alibaba_product_id: productId,
  }));

  const { error } = await supabase
    .from("alibaba_sync_queue")
    .insert(queueItems);

  if (error) {
    throw new Error(`Failed to add to queue: ${error.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      queued: alibabaProductIds.length,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Get sync status
 */
async function handleGetStatus(supabase: any) {
  const { data: recentSyncs } = await supabase
    .from("alibaba_sync_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: queueStatus } = await supabase
    .from("alibaba_sync_queue")
    .select("status, COUNT(*) as count")
    .group_by("status");

  const { data: mappedProducts } = await supabase
    .from("alibaba_product_mapping")
    .select("COUNT(*)", { count: "exact" });

  return new Response(
    JSON.stringify({
      recentSyncs,
      queueStatus,
      totalImportedProducts: mappedProducts?.length || 0,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
