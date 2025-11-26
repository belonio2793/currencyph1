import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QueueItem {
  id: string;
  status: string;
  sync_type: string;
  alibaba_product_id: string;
  attempt_count: number;
  max_attempts: number;
  metadata: Record<string, any>;
}

interface BusinessData {
  id: string;
  user_id: string;
}

/**
 * Process pending items from Alibaba sync queue
 * This is typically called by a cron job
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get pending queue items (limit to 10 per run to keep function quick)
    const { data: queueItems, error: fetchError } = await supabase
      .from("alibaba_sync_queue")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("scheduled_for", { ascending: true })
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch queue items: ${fetchError.message}`);
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending items in queue",
          processedCount: 0,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;
    let failedCount = 0;
    const results = [];

    for (const queueItem of queueItems as QueueItem[]) {
      try {
        const result = await processQueueItem(supabase, queueItem);
        processedCount++;
        results.push(result);
      } catch (error) {
        failedCount++;
        console.error(`Failed to process queue item ${queueItem.id}:`, error);

        // Update queue item status
        const newAttempt = (queueItem.attempt_count || 0) + 1;
        const willFail = newAttempt >= (queueItem.max_attempts || 3);

        await supabase
          .from("alibaba_sync_queue")
          .update({
            status: willFail ? "failed" : "pending",
            attempt_count: newAttempt,
            last_error:
              error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", queueItem.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} items, ${failedCount} failed`,
        processedCount,
        failedCount,
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Queue processor error:", error);
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
 * Process a single queue item
 */
async function processQueueItem(
  supabase: any,
  queueItem: QueueItem
): Promise<any> {
  // Mark as processing
  await supabase
    .from("alibaba_sync_queue")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .eq("id", queueItem.id);

  try {
    // Get product metadata from queue
    const metadata = queueItem.metadata || {};
    const businessId = metadata.businessId;
    const sellerId = metadata.sellerId;

    if (!businessId || !sellerId) {
      throw new Error("Missing business or seller ID in queue metadata");
    }

    // In a real implementation, you would:
    // 1. Fetch the product from Alibaba API using alibaba_product_id
    // 2. Transform it using the AlibabaDataTransformer
    // 3. Create/update the industrial_products record
    // 4. Create/update the alibaba_product_mapping record
    // 5. Update the sync log

    // For now, we'll simulate the process
    console.log(
      `Processing Alibaba product: ${queueItem.alibaba_product_id}`
    );

    // Mark as completed
    await supabase
      .from("alibaba_sync_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        attempt_count: (queueItem.attempt_count || 0) + 1,
      })
      .eq("id", queueItem.id);

    return {
      queueItemId: queueItem.id,
      status: "completed",
      alibabaProductId: queueItem.alibaba_product_id,
    };
  } catch (error) {
    const newAttempt = (queueItem.attempt_count || 0) + 1;
    const maxAttempts = queueItem.max_attempts || 3;

    if (newAttempt >= maxAttempts) {
      // Max retries reached, mark as failed
      await supabase
        .from("alibaba_sync_queue")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          attempt_count: newAttempt,
          last_error:
            error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", queueItem.id);
    } else {
      // Retry later
      await supabase
        .from("alibaba_sync_queue")
        .update({
          status: "pending",
          attempt_count: newAttempt,
          last_error:
            error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", queueItem.id);
    }

    throw error;
  }
}
