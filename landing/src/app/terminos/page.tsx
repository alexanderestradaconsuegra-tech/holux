import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Términos y Condiciones | HOLU",
  description: "Términos y condiciones de uso del sistema HOLU para restaurantes.",
  alternates: { canonical: "https://holu.pro/terminos" },
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y Condiciones" updated="8 de septiembre de 2026">
      <h2>1. Qué es HOLU</h2>
      <p>
        HOLU es un sistema de gestión para restaurantes que conecta mesas, camareros, cocina, caja y
        administración, con módulos opcionales de kiosco de autoservicio, delivery propio y agentes de
        inteligencia artificial. Al contratar y usar HOLU, el restaurante acepta estos términos.
      </p>

      <h2>2. Contratación y planes</h2>
      <p>
        HOLU se ofrece por suscripción mensual o anual, según el plan elegido. El cobro se procesa a
        través de MercadoPago. Los precios vigentes se muestran en holu.pro y pueden actualizarse; un
        cambio de precio no afecta a un período ya pagado.
      </p>

      <h2>3. Cancelación</h2>
      <p>
        Puedes cancelar tu suscripción cuando quieras desde MercadoPago o contactándonos. El servicio
        permanece activo hasta el final del período ya pagado; no se realizan devoluciones proporcionales
        por el tiempo no utilizado, salvo que la ley aplicable indique lo contrario.
      </p>

      <h2>4. Responsabilidad del restaurante</h2>
      <p>
        El restaurante es responsable de la información que carga en el sistema (carta, precios, fotos,
        promociones) y de la veracidad de los datos de contacto que entrega. HOLU no participa en la
        preparación de los alimentos ni en el cumplimiento de normas sanitarias, laborales o tributarias
        del restaurante.
      </p>

      <h2>5. Uso de los agentes de inteligencia artificial</h2>
      <p>
        Cuando el restaurante activa el agente de WhatsApp, el de Telegram, o ambos, un sistema
        automatizado responde a los clientes o al restaurante en su nombre. HOLU pone un esfuerzo
        razonable en que las respuestas sean correctas, pero no garantiza que lo sean en el 100% de los
        casos. El restaurante puede desactivar el agente y volver a la atención humana en cualquier
        momento desde su panel.
      </p>

      <h2>6. Disponibilidad del servicio</h2>
      <p>
        Hacemos esfuerzos razonables para mantener HOLU disponible, pero no garantizamos un funcionamiento
        ininterrumpido. Pueden existir mantenciones programadas o eventos fuera de nuestro control (fallas
        de internet, o de terceros como MercadoPago o los proveedores de mensajería).
      </p>

      <h2>7. Propiedad y datos</h2>
      <p>
        El restaurante conserva la propiedad de su información comercial (carta, ventas, clientes). HOLU
        la utiliza únicamente para prestar el servicio contratado. Más detalles en nuestra{" "}
        <a href="/privacidad">Política de Privacidad</a>.
      </p>

      <h2>8. Modificaciones</h2>
      <p>
        Podemos actualizar estos términos para reflejar cambios en el servicio o en la normativa
        aplicable. Publicaremos la fecha de la última actualización en esta misma página.
      </p>

      <h2>9. Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República de Chile.</p>

      <div className="legal-note">
        Este documento tiene fines informativos generales y no reemplaza la asesoría legal profesional.
        Si tienes dudas sobre cómo aplican estos términos a tu restaurante, te recomendamos consultarlo
        con tu asesor legal.
      </div>
    </LegalPage>
  );
}
