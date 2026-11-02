// Resolve handles privately. Supabase Auth verifies the password before tokens leave this function.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers });
const invalid = () => reply(401, { error: "Incorrect username or password." });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  try {
    const input = await req.json().catch(() => null);
    const username =
      typeof input?.username === "string"
        ? input.username.trim().toLowerCase()
        : "";
    if (
      !/^[a-z0-9_]{3,24}$/.test(username) ||
      typeof input.password !== "string" ||
      !input.password ||
      input.password.length > 4096
    )
      return invalid();
    const base = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminHeaders = {
      apikey: service,
      Authorization: "Bearer " + service,
    };
    const lookup = await fetch(
      base + "/rest/v1/account_handles?select=user_id&username=eq." + username,
      { headers: adminHeaders },
    );
    if (!lookup.ok) throw new Error("Lookup unavailable");
    const [handle] = await lookup.json();
    let email = "missing-" + crypto.randomUUID() + "@example.invalid";
    if (handle) {
      const account = await fetch(
        base + "/auth/v1/admin/users/" + handle.user_id,
        { headers: adminHeaders },
      );
      if (!account.ok) throw new Error("Auth unavailable");
      email = (await account.json()).email || email;
    }
    const auth = await fetch(base + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({ email, password: input.password }),
    });
    if (auth.status === 429)
      return reply(429, { error: "Too many attempts. Try again later." });
    if (auth.status >= 500) throw new Error("Auth unavailable");
    if (!auth.ok) return invalid();
    const result = await auth.json();
    if (
      !handle ||
      result.user?.id !== handle.user_id ||
      !result.access_token ||
      !result.refresh_token
    )
      return invalid();
    return reply(200, {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    });
  } catch {
    return reply(503, { error: "Sign-in is temporarily unavailable." });
  }
});
