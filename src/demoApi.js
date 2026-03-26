import express from "express";

const app = express();
app.use(express.json());

let activeCheckout = 0;
let checkoutPool = 50;

app.get("/openapi.json", (_req, res) => {
  res.json({
    openapi: "3.0.0",
    info: { title: "Demo Checkout API", version: "1.0.0" },
    paths: {
      "/auth/login": {
        post: {
          summary: "Authenticate a shopper",
          responses: {
            200: {
              description: "Login ok"
            }
          }
        }
      },
      "/cart": {
        get: {
          summary: "Read the cart",
          responses: {
            200: {
              description: "Cart payload"
            }
          }
        }
      },
      "/checkout": {
        post: {
          summary: "Submit checkout",
          responses: {
            200: {
              description: "Checkout ok"
            }
          }
        }
      }
    }
  });
});

app.post("/auth/login", (_req, res) => {
  res.json({ token: "demo-token" });
});

app.get("/cart", (_req, res) => {
  res.json({ items: [{ id: "sku-1", quantity: 1 }] });
});

app.post("/checkout", async (_req, res) => {
  activeCheckout += 1;
  const overloaded = activeCheckout > checkoutPool;
  const latency = overloaded ? 1200 : 80;
  await new Promise((resolve) => setTimeout(resolve, latency));
  activeCheckout -= 1;

  if (overloaded) {
    return res.status(503).json({ error: "connection pool exhausted" });
  }

  return res.json({ status: "ok", orderId: `${Date.now()}` });
});

app.post("/admin/pool/:size", (req, res) => {
  checkoutPool = Number(req.params.size || 50);
  res.json({ checkoutPool });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`Demo API listening on http://localhost:${port}`);
});
