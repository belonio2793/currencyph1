import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AlibabaSyncRequest {
  action: "sync" | "manual" | "queue-sync" | "get-status" | "trigger-full";
  syncType?: "full" | "incremental" | "manual";
  alibabaProductIds?: string[];
  businessId?: string;
}

interface AlibabaConfig {
  id: string;
  app_id: string;
  sync_enabled: boolean;
  sync_frequency_minutes: number;
  auto_sync_on_startup: boolean;
  filter_by_category: boolean;
  allowed_categories: string[];
  min_price: number;
  max_price: number;
  import_images: boolean;
  import_certifications: boolean;
  max_products_per_sync: number;
  last_full_sync: string | null;
  last_incremental_sync: string | null;
  is_active: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = (await req.json()) as AlibabaSyncRequest;

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

      case "trigger-full":
        return await handleTriggerFullSync(supabase, body.businessId);

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
    const { data: config } = await supabase
      .from("alibaba_config")
      .select("*")
      .eq("is_active", true)
      .single();

    if (!config?.is_active || !config?.app_id) {
      throw new Error("Alibaba not configured or disabled");
    }

    const appId = Deno.env.get("VITE_ALIBABA_APP_ID");
    const apiKey = Deno.env.get("VITE_ALIBABA_API_KEY");

    if (!appId || !apiKey) {
      throw new Error("Alibaba API credentials not configured");
    }

    const { data: business } = await supabase
      .from("businesses")
      .select("id, user_id")
      .eq("id", businessId || "")
      .limit(1)
      .single();

    if (!business) {
      throw new Error("No business found");
    }

    const queueItems = [];
    let productsImported = 0;

    // TODO: Integrate with Alibaba API when credentials available
    console.log("Alibaba sync initialized:", {
      syncType,
      businessId: business.id,
      maxProducts: config.max_products_per_sync,
    });

    await supabase
      .from("alibaba_sync_log")
      .update({
        status: "completed",
        end_time: new Date().toISOString(),
        products_imported: productsImported,
      })
      .eq("id", syncLog.id);

    if (syncType === "full") {
      await supabase
        .from("alibaba_config")
        .update({ last_full_sync: new Date().toISOString() })
        .eq("id", config.id);
    } else {
      await supabase
        .from("alibaba_config")
        .update({ last_incremental_sync: new Date().toISOString() })
        .eq("id", config.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${syncType} sync completed. Products imported: ${productsImported}`,
        syncLogId: syncLog.id,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
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
    .limit(1)
    .single();

  if (!business) {
    return new Response(
      JSON.stringify({ error: "Business not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

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
      queuedItems: queueItems.length,
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
 * Get sync status and statistics
 */
async function handleGetStatus(supabase: any) {
  const { data: recentSyncs } = await supabase
    .from("alibaba_sync_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: queueStats } = await supabase
    .from("alibaba_sync_queue")
    .select("status")
    .order("created_at", { ascending: false });

  const { data: config } = await supabase
    .from("alibaba_config")
    .select("*")
    .single();

  const { count: totalMapped } = await supabase
    .from("alibaba_product_mapping")
    .select("*", { count: "exact", head: true });

  const queueStatusMap = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  (queueStats || []).forEach((item: { status: string }) => {
    if (item.status in queueStatusMap) {
      queueStatusMap[item.status as keyof typeof queueStatusMap]++;
    }
  });

  return new Response(
    JSON.stringify({
      config: {
        is_active: config?.is_active || false,
        sync_enabled: config?.sync_enabled || false,
        sync_frequency_minutes: config?.sync_frequency_minutes || 60,
        last_full_sync: config?.last_full_sync,
        last_incremental_sync: config?.last_incremental_sync,
      },
      recentSyncs: recentSyncs || [],
      queueStatus: queueStatusMap,
      totalImportedProducts: totalMapped || 0,
      timestamp: new Date().toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Trigger a full sync (manual endpoint)
 */
async function handleTriggerFullSync(
  supabase: any,
  businessId?: string
) {
  return await handleSync(supabase, "full", businessId);
}
