// Serverless Function en Vercel (Node.js)
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET, { apiVersion: "2023-10-16" });

// cambia al dominio real de tu web
const ORIGIN = "https://ingrix.es";

// 🔹 Añadido: permite también preflight y evita el “Failed to fetch”
module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  const allowOrigin = origin === ORIGIN ? origin : ORIGIN;

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { items = [], customer_email } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "No items" });
    }

    const line_items = items.map((i) => ({
      price_data: {
        currency: "eur",
        product_data: { name: String(i.name || "Producto") },
        unit_amount: Math.round(Number(i.unit_amount_eur) * 100)
      },
      quantity: Number(i.quantity) || 1
    }));

    const session = await stripe.checkout.sessions.create({
      locale: req.body.locale || "auto",
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["ES"] },
      success_url: `${ORIGIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/cancel.html`,
      customer_email: customer_email || undefined
    });

    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error(err);
    res.setHeader("Access-Control-Allow-Origin", ORIGIN);
    return res.status(500).json({ error: "stripe_error" });
  }
};
