// /api/checkout.js (Vercel, Node.js)
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET, { apiVersion: "2023-10-16" });

const ALLOWED_ORIGINS = [
  "https://ingrix.es",
  // añade tus previews si hace falta: "https://ingrix-*.vercel.app"
];
const ENVIO_CENTS = 499; // 4,99 €

function allowOrigin(req, res) {
  const o = req.headers.origin || "";
  const ok = ALLOWED_ORIGINS.find((x) => o === x || (x.includes("*.vercel.app") && o.endsWith(".vercel.app")));
  const origin = ok ? o : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
}

module.exports = async (req, res) => {
  allowOrigin(req, res);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      items = [],
      customer_email,
      token,
      locale = "es",
      shippingMethod = "pickup", // 'pickup' | 'shipping'
    } = req.body || {};

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "No items" });
    }

    // Ignora si el front metió un ítem "Envío" por error
    const line_items = items
      .filter((i) => String(i.name || "").toLowerCase() !== "envío a domicilio")
      .map((i) => {
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

    const meta = {
      pedido_token: token ? String(token) : "",
      shippingMethod,
    };

    const params = {
      mode: "payment",
      locale,
      payment_method_types: ["card"],
      line_items,
      allow_promotion_codes: true,

      // URLs reales de tu web
      success_url: `https://ingrix.es/exito.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://ingrix.es/carrito.html`,

      client_reference_id: token || undefined,
      metadata: meta,
      payment_intent_data: { metadata: meta },
      customer_email: customer_email || undefined,
    };

    if (shippingMethod === "shipping") {
      // Sólo si es envío: pedir dirección y añadir tarifa 4,99 €
      params.shipping_address_collection = { allowed_countries: ["ES"] };
      params.shipping_options = [
        {
          shipping_rate_data: {
            display_name: "Envío Península y Baleares",
            type: "fixed_amount",
            fixed_amount: { amount: ENVIO_CENTS, currency: "eur" },
          },
        },
      ];
    }
    // Si es 'pickup' NO añadimos shipping_options ni pedimos dirección.

    const session = await stripe.checkout.sessions.create(params);
    allowOrigin(req, res);
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error(err);
    allowOrigin(req, res);
    return res.status(500).json({ error: "stripe_error", message: err.message });
  }
};
