// Serverless Function en Vercel (Node.js)
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET, { apiVersion: "2023-10-16" });

const ORIGIN = "https://ingrix.es";
const ENVIO_CENTS = 499; // 4,99 €

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  const allowOrigin = origin === ORIGIN ? origin : ORIGIN;

  // CORS
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { items = [], customer_email, token, locale } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "No items" });
    }

    // Line items (solo productos; el envío va aparte como shipping_options)
    const line_items = items.map((i) => {
      const amount = Math.round(Number(i.unit_amount_eur) * 100);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`Invalid unit_amount_eur for item "${i.name}"`);
      }
      return {
        price_data: {
          currency: "eur",
          product_data: { name: String(i.name || "Producto") },
          unit_amount: amount,
        },
        quantity: Number(i.quantity) || 1,
      };
    });

    // Metadatos para vincular con el email de diseños
    const meta = token ? { pedido_token: String(token) } : {};

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: locale || "auto",
      payment_method_types: ["card"],
      line_items,
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ["ES"] },

      // 🚛 Envío fijo 4,99 €
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: "Envío Península y Baleares",
            type: "fixed_amount",
            fixed_amount: { amount: ENVIO_CENTS, currency: "eur" },
          },
        },
      ],

      // Vínculos para rastrear el pedido
      client_reference_id: token || undefined,
      metadata: meta,
      payment_intent_data: { metadata: meta },

      // URLs de retorno
      success_url: `${ORIGIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/cancel.html`,

      // Email (opcional)
      customer_email: customer_email || undefined,
    });

    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error(err);
    res.setHeader("Access-Control-Allow-Origin", ORIGIN);
    return res.status(500).json({ error: "stripe_error", message: err.message });
  }
};
