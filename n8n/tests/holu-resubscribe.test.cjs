const fs=require('fs'); const assert=require('assert');
const code=fs.readFileSync(__dirname+'/../holu-resubscribe-prepare.code.js','utf8');
const AF=Object.getPrototypeOf(async function(){}).constructor;
const users={ 'tok-owner-aaaaaaaaaaaaaaaa':{id:'1',email:'Dueno@A.cl',app_metadata:{restaurant_id:'rest-a',role:'admin'},user_metadata:{restaurant_id:'rest-b'}},
  'tok-waiter-aaaaaaaaaaaaaaa':{id:'2',email:'x@holu.internal',app_metadata:{restaurant_id:'rest-a',role:'camarero',staff_id:'s'}} };
const run=async(body)=>{ const helpers={httpRequest:async(o)=>{const t=o.headers.Authorization.replace('Bearer ','');const u=users[t];return u?{statusCode:200,body:u}:{statusCode:401,body:{}};}};
  const fn=new AF('$input','$env',code); return (await fn.call({helpers},{first:()=>({json:{body}})},{SUPABASE_SERVICE_ROLE_KEY:'k'}))[0].json; };
const ok=async(n,f)=>{try{await f();console.log('  ok  '+n)}catch(e){console.log('  FALLA '+n+': '+e.message);process.exitCode=1}};
const rej=async(body)=>{let e;try{await run(body)}catch(x){e=x}assert.ok(e,'debía rechazar');return e.message};
(async()=>{
 await ok('dueño reactiva su restaurante',async()=>{const r=await run({access_token:'tok-owner-aaaaaaaaaaaaaaaa',restaurant_id:'rest-a',payer_email:'pago@a.cl'});assert.deepEqual(r,{restaurant_id:'rest-a',payer_email:'pago@a.cl',plan:'pro',amount:19990,back_url:'https://app.holu.pro/?pago=listo'})});
 await ok('sin restaurant_id en el body usa el de su sesión y su correo',async()=>{const r=await run({access_token:'tok-owner-aaaaaaaaaaaaaaaa'});assert.equal(r.restaurant_id,'rest-a');assert.equal(r.payer_email,'dueno@a.cl')});
 await ok('NO usa el user_metadata (dice rest-b)',async()=>{const r=await run({access_token:'tok-owner-aaaaaaaaaaaaaaaa'});assert.notEqual(r.restaurant_id,'rest-b')});
 await ok('restaurant_id de otro restaurante se rechaza',async()=>assert.match(await rej({access_token:'tok-owner-aaaaaaaaaaaaaaaa',restaurant_id:'rest-b',payer_email:'a@b.cl'}),/No autorizado/));
 await ok('sin token se rechaza',async()=>assert.match(await rej({restaurant_id:'rest-a',payer_email:'a@b.cl'}),/No autorizado/));
 await ok('token inválido se rechaza',async()=>assert.match(await rej({access_token:'x'.repeat(40),restaurant_id:'rest-a'}),/No autorizado/));
 await ok('un mozo no puede iniciar el cobro',async()=>assert.match(await rej({access_token:'tok-waiter-aaaaaaaaaaaaaaa',restaurant_id:'rest-a'}),/No autorizado/));
 await ok('correo inválido',async()=>assert.match(await rej({access_token:'tok-owner-aaaaaaaaaaaaaaaa',payer_email:'nada'}),/Invalid email/));
 await ok('back_url del navegador se ignora',async()=>{const r=await run({access_token:'tok-owner-aaaaaaaaaaaaaaaa',back_url:'https://malo.example'});assert.equal(r.back_url,'https://app.holu.pro/?pago=listo')});
 await ok('el monto no lo manda el navegador',async()=>{const r=await run({access_token:'tok-owner-aaaaaaaaaaaaaaaa',amount:1});assert.equal(r.amount,19990)});
})();
