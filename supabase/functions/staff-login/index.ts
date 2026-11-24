// Exchanges a restaurant id + employee PIN for a real Supabase session.
//
// Employees sign in with a PIN, not an email, so without this they would keep
// operating on the anon key and RLS could not tell one restaurant from another.
// Here the PIN is checked with the service role (which never leaves the edge
// runtime) and the caller gets back a normal access/refresh token pair whose
// app_metadata carries restaurant_id, role and staff_id — exactly what
// get_user_restaurant_id() reads, so every existing mt_* policy applies to staff
// too. It MUST be app_metadata: user_metadata can be edited by the signed-in
// user, which would let any employee switch themselves to another restaurant.
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

  // pin_hash is stored as crypt(p_pin, gen_salt('bf', 10)) (see set_staff_pin
  // in supabase/migrations/20260825133745_fix_staff_pin_login_and_table_orders.sql),
  // so it can never be matched with a plain `.eq("pin_hash", pin)` — that
  // compares the bcrypt hash against the raw PIN and always fails. The
  // staff_login() RPC in that same migration verifies it correctly with
  // `pin_hash = crypt(p_pin, pin_hash)`, so use that instead of reimplementing
  // the comparison here.
  const { data: staffRows, error: staffLoginError } = await admin.rpc("staff_login", {
    p_restaurant_id: restaurantId,
    p_pin: pin,
  });

  if (staffLoginError) {
    console.error("staff_login rpc failed", staffLoginError.message);
  }

  const staff = Array.isArray(staffRows) ? staffRows[0] : staffRows;

  if (!staff) {
    await admin.from("pin_attempts").insert({ restaurant_id: restaurantId, succeeded: false });
    return json({ error: "invalid_credentials" }, 401);
  }

  // staff_login() only returns the columns the client is allowed to see, so
  // auth_user_id (needed below to reuse/rotate the existing auth user instead
  // of creating a duplicate one) is fetched separately with the service role,
  // which bypasses RLS entirely.
  const { data: staffAuthRow } = await admin
    .from("staff")
    .select("auth_user_id")
    .eq("id", staff.id)
    .maybeSingle();

  // The password is rotated on every login and never reaches the client, so it
  // is only ever a one-shot handle used to mint this session.
  const email = `staff.${staff.id}@holu.internal`;
  const password = randomPassword();
  // Only the server can write app_metadata; RLS and set_staff_pin() trust it.
  const appMetadata = {
    restaurant_id: restaurantId,
    role: staff.role,
    staff_id: staff.id,
  };
  // user_metadata is cosmetic (shown in the UI) and never used to authorize.
  const metadata = {
    restaurant_id: restaurantId,
    staff_id: staff.id,
    staff_role: staff.role,
    name: staff.name,
  };

  let authUserId = staffAuthRow?.auth_user_id as string | null ?? null;

  if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      app_metadata: appMetadata,
      user_metadata: metadata,
    });
    if (error) authUserId = null; // user was deleted out from under us; recreate
  }

  if (!authUserId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: appMetadata,
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
