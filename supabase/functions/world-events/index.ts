import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, userId, characterId, city, data } = await req.json();

    if (action === "save_event") {
      const { error } = await supabaseClient.from("world_events").insert([
        {
          user_id: userId,
          character_id: characterId,
          city: city,
          event_type: data.type,
          event_data: data,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "Event saved" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_nearby_players") {
      const { data: players, error } = await supabaseClient
        .from("game_characters")
        .select("id, name, current_location")
        .eq("current_location", city)
        .neq("id", characterId)
        .limit(20);

      if (error) throw error;

      return new Response(JSON.stringify({ players: players || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "npc_trade") {
      // Handle NPC trading logic
      const { npcId, tradeAmount, tradeType } = data;

      // Update character stats
      const { error: updateError } = await supabaseClient
        .from("game_characters")
        .update({
          money: data.characterMoney,
          experience: data.characterExp,
        })
        .eq("id", characterId);

      if (updateError) throw updateError;

      // Log trade event
      await supabaseClient.from("world_events").insert([
        {
          user_id: userId,
          character_id: characterId,
          city: city,
          event_type: "npc_trade",
          event_data: {
            npcId,
            tradeAmount,
            tradeType,
            timestamp: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        },
      ]);

      return new Response(
        JSON.stringify({ success: true, message: "Trade recorded" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
