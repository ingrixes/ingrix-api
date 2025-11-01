// Serverless Function en Vercel (Node.js)
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET, { apiVersion: "2023-10-16" });

// cambia al dominio real de tu web
const ORIGIN = "https://ingrix.es";

module.exports = async (req, res) => {
  // CORS básico
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { items = [], customer_email } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "No items" });
    }

    // Espera items con { name, unit_amount_eur, quantity }
    const line_items = items.map((i) => ({
      price_data: {
        currency: "eur",
        product_data: { name: String(i.name || "Producto") },
        unit_amount: Math.round(Number(i.unit_amount_eur) * 100)
      },
      quantity: Number(i.quantity) || 1
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["ES"] },
      success_url: `${ORIGIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/cancel.html`,
      customer_email: customer_email || undefined
    });

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "stripe_error" });
  }
};
