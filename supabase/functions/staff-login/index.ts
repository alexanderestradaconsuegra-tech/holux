// Exchanges a restaurant id + employee PIN for a real Supabase session.
//
// Employees sign in with a PIN, not an email, so without this they would keep
// operating on the anon key and RLS could not tell one restaurant from another.
// Here the PIN is checked with the service role (which never leaves the edge
// runtime) and the caller gets back a normal access/refresh token pair whose
// user_metadata carries restaurant_id — exactly what get_user_restaurant_id()
// reads, so every existing mt_* policy starts applying to staff too.
//
// Deploy:  supabase functions deploy staff-login --no-verify-jwt

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// A 4-digit PIN has 10k combinations, so unlimited guessing would be trivial.
const MAX_FAILURES = 10;
const WINDOW_MINUTES = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const randomPassword = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let restaurantId = "";
  let pin = "";
  try {
    const body = await req.json();
    restaurantId = String(body.restaurant_id || "").trim();
    pin = String(body.pin || "").trim();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  if (!restaurantId || !/^\d{4,8}$/.test(pin)) {
    return json({ error: "invalid_credentials" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count: failures } = await admin
    .from("pin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("succeeded", false)
    .gte("created_at", since);

  if ((failures ?? 0) >= MAX_FAILURES) {
    return json({ error: "too_many_attempts", retry_after_minutes: WINDOW_MINUTES }, 429);
  }

  const { data: staff } = await admin
    .from("staff")
    .select("id, name, role, shift, avatar_url, auth_user_id")
    .eq("restaurant_id", restaurantId)
    .eq("pin_hash", pin)
    .eq("status", "Activo")
    .neq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (!staff) {
    await admin.from("pin_attempts").insert({ restaurant_id: restaurantId, succeeded: false });
    return json({ error: "invalid_credentials" }, 401);
  }

  // The password is rotated on every login and never reaches the client, so it
  // is only ever a one-shot handle used to mint this session.
  const email = `staff.${staff.id}@holu.internal`;
  const password = randomPassword();
  const metadata = {
    restaurant_id: restaurantId,
    staff_id: staff.id,
    staff_role: staff.role,
    name: staff.name,
  };

  let authUserId = staff.auth_user_id as string | null;

  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      user_metadata: metadata,
    });
    if (error) authUserId = null; // user was deleted out from under us; recreate
  }

  if (!authUserId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error || !created?.user) {
      console.error("createUser failed", error?.message);
      return json({ error: "auth_provisioning_failed" }, 500);
    }
    authUserId = created.user.id;
    await admin.from("staff").update({ auth_user_id: authUserId }).eq("id", staff.id);
  }

  const publicClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: signInError } = await publicClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !session?.session) {
    console.error("signIn failed", signInError?.message);
    return json({ error: "auth_signin_failed" }, 500);
  }

  await admin.from("pin_attempts").insert({ restaurant_id: restaurantId, succeeded: true });

  return json({
    staff: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      shift: staff.shift ?? "",
      avatar_url: staff.avatar_url ?? "",
    },
    session: {
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
      expires_at: session.session.expires_at,
      restaurant_id: restaurantId,
    },
  });
});
