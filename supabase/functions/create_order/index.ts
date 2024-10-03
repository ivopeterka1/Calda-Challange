import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  if (req.method === "POST") {
    // Pridobi podatke iz telesa zahteve
    const { user_id, shipping_address, recipient_name, products } = await req.json();

    console.log(user_id);
    console.log(shipping_address);
    console.log(recipient_name);

    // Vstavi novo naročilo
    const { data: newOrder, error: orderError } = await supabase
      .from("order")
      .insert({
        user_id,
        shipping_address,
        recipient_name,
      })
      .select();

    console.log("Order created successfully.");

    if (orderError) {
      console.error("Error creating order:", orderError);
      return new Response(JSON.stringify({ error: orderError.message }), { status: 400 });
    }

    // Vstavi naročilo izdelke
    const orderId = newOrder[0].id; // Predpostavljamo, da je id prvi v vrnjenem nizu
    for (const product of products) {
      const { error } = await supabase
        .from("order_items")
        .insert({
          order_id: orderId,
          product_id: product.id,
          quantity: product.quantity,
          price_at_order: product.price, // Predpostavimo, da izdelek vsebuje ceno
        });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    // Pridobi vse naročilo izdelke in izračunaj skupno vrednost
    const { data: allOrderItems, error: orderItemsError } = await supabase
      .from("order_items")
      .select("quantity, product_id");

    if (orderItemsError) {
      return new Response(JSON.stringify({ error: orderItemsError.message }), { status: 400 });
    }

    // Pridobi cene izdelkov
    const productIds = allOrderItems.map((item) => item.product_id);
    const { data: allProducts, error: productsError } = await supabase
      .from("product")
      .select("id, price")
      .in("id", productIds);

    if (productsError) {
      return new Response(JSON.stringify({ error: productsError.message }), { status: 400 });
    }

    // Izračunaj skupno vrednost
    let totalSum = 0;
    for (const orderItem of allOrderItems) {
      for (const product of allProducts) {
        if (orderItem.product_id == product.id) {
          totalSum += product.price * orderItem.quantity;
        }
      }
    }

    return new Response(JSON.stringify({ totalSum }), { status: 200 });
  }

  return new Response("Only POST requests are allowed", { status: 405 });
});
