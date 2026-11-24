// Un restaurante que ya existe reactiva una suscripción vencida. Ya tiene
// restaurant_id, así que se salta signups/restaurant-onboard (esa ruta es solo
// para entregar una cuenta nueva una vez).
//
// Quién llama se verifica contra Supabase con su propia sesión: solo el
// administrador de ESE restaurante puede iniciar el cobro (antes cualquiera que
// conociera un restaurant_id podía cancelar el intento de pago pendiente de otro).
// El restaurante sale de app_metadata, que solo escribe el servidor.
const b = $input.first().json.body ?? $input.first().json;

const token = typeof b.access_token === 'string' ? b.access_token.trim() : '';
if (token.length < 20) throw new Error('No autorizado');

const who = await this.helpers.httpRequest({
  method: 'GET',
  url: 'https://nlwrkumlrudfgsdnhfhw.supabase.co/auth/v1/user',
  headers: { apikey: $env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + token },
  json: true, ignoreHttpStatusErrors: true, returnFullResponse: true,
});
const u = who.body || {};
if (who.statusCode !== 200 || !u.id) throw new Error('No autorizado');
const am = u.app_metadata || {};
if (am.role !== 'admin' || !am.restaurant_id) throw new Error('No autorizado');
const restaurant_id = String(am.restaurant_id);
if (b.restaurant_id && String(b.restaurant_id).trim() !== restaurant_id) throw new Error('No autorizado');

const payer_email = String(b.payer_email || u.email || '').trim().toLowerCase();
if (!/^[^@]+@[^@]+\.[^@]+$/.test(payer_email)) throw new Error('Invalid email address');

// Un solo plan, un solo precio - nunca lo manda el navegador. La URL de
// retorno tampoco: es siempre el panel.
const amount = 19990;

return [{ json: {
  restaurant_id,
  payer_email,
  plan: 'pro', amount,
  back_url: 'https://app.holu.pro/?pago=listo',
}}];
