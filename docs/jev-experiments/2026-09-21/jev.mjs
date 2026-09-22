// Throwaway: one call to Jev (TypeSafe System One) over plain fetch. Run with: node --env-file=.env <script>
const KEY = process.env.TYPESAFE_API_KEY;
if (!KEY) throw new Error("TYPESAFE_API_KEY is not set");

export async function ask(state, questions, model = "jev-latest") {
  const started = performance.now();
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ state, model, questions }),
  });
  const ms = performance.now() - started;
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return { ...(await response.json()), ms };
}
