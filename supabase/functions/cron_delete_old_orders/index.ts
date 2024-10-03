import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
    if (req.method === "POST") {
        // Pridobi naročila, starejša od enega tedna
        const { data: oldOrders, error: fetchError } = await supabase
            .from("order")
            .select("id, total_price")
            .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (fetchError) {
            return new Response(JSON.stringify({ error: fetchError.message }), { status: 400 });
        }

        // Shranimo vsoto naročil
        let totalSum = 0;
        for (const order of oldOrders) {
            totalSum += parseFloat(order.total_price || "0");
        }

        // Vstavi vsoto v tabelo archived_order_sums
        const { error: insertError } = await supabase
            .from("archived_order_sums")
            .insert({ total_price: totalSum });

        if (insertError) {
            return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
        }

        // Izbriše stara naročila
        const { error: deleteError } = await supabase
            .from("order")
            .delete()
            .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (deleteError) {
            return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
        }

        return new Response("Old orders deleted and total price recorded successfully in archived_order_sums", { status: 200 });
    }

    return new Response("Only POST requests are allowed", { status: 405 });
});