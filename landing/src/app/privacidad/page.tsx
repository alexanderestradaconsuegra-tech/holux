import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacidad y Uso de IA | HOLU",
  description:
    "Política de privacidad, protección de datos personales y uso de inteligencia artificial en HOLU, conforme a la normativa chilena.",
  alternates: { canonical: "https://holu.pro/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Privacidad, Datos Personales y Uso de IA" updated="8 de septiembre de 2026">
      <h2>1. Quién trata tus datos</h2>
      <p>
        HOLU presta un sistema de gestión a restaurantes ("Clientes"). Cada restaurante es responsable de
        los datos de sus propios clientes finales y empleados que ingresa al sistema; HOLU actúa como
        encargado del tratamiento, procesando esos datos únicamente para prestar el servicio contratado.
      </p>

      <h2>2. Marco legal</h2>
      <p>
        Esta política se elabora conforme a la Ley N° 19.628 sobre Protección de la Vida Privada y a la
        Ley N° 21.719, que establece un nuevo marco de protección de datos personales y crea la Agencia de
        Protección de Datos Personales en Chile. Chile aún no cuenta con una ley específica sobre
        inteligencia artificial en plena vigencia; existe un proyecto de ley en el Congreso inspirado en
        el Reglamento de IA de la Unión Europea. Mientras ese marco se termina de definir, HOLU aplica de
        forma voluntaria los principios de transparencia, minimización de datos y supervisión humana
        descritos más abajo.
      </p>

      <h2>3. Qué datos recopilamos</h2>
      <ul>
        <li>Del restaurante: nombre del negocio, dirección, contacto, y medio de pago para la suscripción.</li>
        <li>De los empleados que usan el sistema: nombre y PIN de acceso, para identificar quién toma cada pedido o llamado.</li>
        <li>
          De los clientes finales: los datos necesarios para completar un pedido — nombre, teléfono y
          dirección de entrega cuando corresponde. No pedimos datos financieros; los pagos se procesan
          directamente por MercadoPago.
        </li>
      </ul>

      <h2>4. Uso de inteligencia artificial</h2>
      <p>
        Cuando un restaurante activa el agente de WhatsApp o el agente de Telegram, los mensajes del
        cliente o del restaurante se envían a un modelo de lenguaje para generar una respuesta (tomar un
        pedido, responder una pregunta sobre el menú, o entregar información operativa al restaurante).
        Sobre este procesamiento:
      </p>
      <ul>
        <li>El cliente que escribe por WhatsApp interactúa con un sistema automatizado, no con una persona, salvo que el pedido se derive a alguien del equipo.</li>
        <li>El restaurante puede pedir en cualquier momento que una conversación se atienda directamente por una persona.</li>
        <li>Solo se envían al modelo los datos necesarios para resolver la conversación (el mensaje, el menú disponible y el estado del pedido en curso) — nunca información de otros restaurantes ni de otros clientes.</li>
        <li>Las conversaciones se guardan por un tiempo limitado para dar seguimiento al pedido, y pueden eliminarse a pedido del restaurante.</li>
      </ul>

      <h2>5. Con quién compartimos datos</h2>
      <p>
        Compartimos datos únicamente con los proveedores necesarios para operar el servicio: MercadoPago
        (pagos), el proveedor de mensajería de WhatsApp o Telegram (envío y recepción de mensajes), y el
        proveedor del modelo de IA (para generar respuestas). No vendemos datos personales a terceros.
      </p>

      <h2>6. Seguridad</h2>
      <p>
        La información de cada restaurante está separada a nivel de base de datos, de forma que un
        restaurante no puede acceder a los datos de otro. Las conexiones al sistema usan cifrado en
        tránsito, y el acceso al panel de administración requiere inicio de sesión.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        Como titular de tus datos, puedes solicitar acceso, rectificación, cancelación u oposición al
        tratamiento de tu información (derechos ARCO) escribiendo al restaurante donde hiciste tu pedido,
        o directamente a HOLU si tu solicitud es sobre datos de un empleado o del restaurante mismo.
      </p>

      <h2>8. Retención de datos</h2>
      <p>
        Conservamos los datos mientras la cuenta del restaurante esté activa, y por el tiempo adicional
        necesario para cumplir obligaciones legales o resolver disputas. El restaurante puede pedir la
        eliminación de datos de un cliente específico en cualquier momento.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Este sitio usa cookies técnicas necesarias para su funcionamiento (por ejemplo, mantener tu sesión
        iniciada). No usamos cookies de rastreo publicitario de terceros.
      </p>

      <h2>10. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta política para reflejar cambios en el servicio o en la normativa chilena de
        protección de datos e inteligencia artificial. La fecha de la última actualización siempre está
        publicada en esta página.
      </p>

      <div className="legal-note">
        Este documento tiene fines informativos generales y no constituye asesoría legal. La normativa de
        inteligencia artificial en Chile está en desarrollo; recomendamos a cada restaurante revisar esta
        información con su propio asesor legal para su caso particular.
      </div>
    </LegalPage>
  );
}
