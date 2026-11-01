/**
 * Documento legal que el usuario acepta al crear su cuenta.
 *
 * Vive en `domain` y no dentro de una feature porque lo necesitan dos: el
 * registro (`features/auth`), que muestra la casilla de aceptación y guardará
 * la versión aceptada, y la pantalla de lectura (`features/legal`). Una
 * feature no importa de otra (Fase 2), así que lo que comparten vive aquí.
 *
 * El contenido es **estático a propósito, por ahora**: viaja en el bundle para
 * que se pueda leer sin conexión y sin esperar una petición. La forma de
 * `LegalDocument` es la misma que tendría la respuesta de un `GET /legal/terms`,
 * así que el día que el documento se sirva desde el backend solo cambia de
 * dónde sale `TERMS`: ni la pantalla ni la casilla se enteran.
 *
 * Convenciones para editar el contenido:
 *  - `number` y el orden son los del documento firmado; no se renumera aquí.
 *  - `title` va en mayúscula inicial ("Vigencia", no "VIGENCIA"): el título es
 *    una etiqueta de navegación y en versales se lee peor. El texto que obliga
 *    —los párrafos y las viñetas— se copia **literal**, sin reescribir.
 *  - cuando el documento cambie hay que subir `version`: es lo que viajará al
 *    backend como prueba de qué fue exactamente lo que el usuario aceptó.
 */

/* ── Tipos ───────────────────────────────────────────────────────────────── */

/** Un bloque dentro de una cláusula: párrafo corrido o lista de viñetas. */
export type LegalBlock =
  | { kind: 'text'; text: string }
  | { kind: 'bullets'; items: string[] };

export interface LegalSection {
  /** Numeración tal como aparece en el documento ("26"). */
  number: string;
  title: string;
  blocks: LegalBlock[];
}

/** Pie del documento: quién responde y dónde encontrarlo. */
export interface LegalContact {
  name: string;
  tagline: string;
  website: string;
  email: string;
}

export interface LegalDocument {
  title: string;
  /**
   * Versión aceptada. Se usa la fecha de vigencia en formato ISO porque el
   * documento no declara un número de versión propio, y es lo que viajará al
   * backend junto con la aceptación cuando exista el campo.
   */
  version: string;
  /** Fecha de entrada en vigencia, ya redactada para mostrar. */
  effectiveFrom: string;
  sections: LegalSection[];
  contact: LegalContact;
}

/* ── Términos y Condiciones ──────────────────────────────────────────────── */

export const TERMS: LegalDocument = {
  title: 'Términos y Condiciones y Política de Tratamiento de Datos Personales',
  version: '2026-10-14',
  effectiveFrom: '14 de octubre de 2026',

  sections: [
    {
      number: '1',
      title: 'Información general',
      blocks: [
        {
          kind: 'text',
          text:
            'Estos Términos y Condiciones regulan el acceso, registro y uso de la ' +
            'aplicación móvil fiao (en adelante, "fiao" o la "Aplicación").',
        },
        {
          kind: 'text',
          text:
            'fiao es una herramienta digital dirigida a pequeños comerciantes que permite ' +
            'gestionar información relacionada con clientes, ventas a crédito, cuentas por ' +
            'cobrar, abonos y saldos pendientes.',
        },
        {
          kind: 'text',
          text:
            'Al registrarse, acceder o utilizar fiao, el Usuario declara que ha leído, ' +
            'comprendido y aceptado estos Términos y Condiciones y la Política de ' +
            'Tratamiento de Datos Personales.',
        },
      ],
    },

    {
      number: '2',
      title: 'Definiciones',
      blocks: [
        { kind: 'text', text: 'Para efectos de estos términos:' },
        {
          kind: 'bullets',
          items: [
            '"Usuario": persona que crea una cuenta y utiliza fiao.',
            '"Cliente": persona registrada por el Usuario dentro de fiao para gestionar ' +
              'información relacionada con ventas a crédito, obligaciones o pagos.',
            '"Datos personales": cualquier información que permita identificar o hacer ' +
              'identificable a una persona.',
            '"Información de crédito": información relacionada con valores prestados, ' +
              'ventas a crédito, fechas de las operaciones, abonos, saldos pendientes y ' +
              'demás información registrada por el Usuario dentro de la Aplicación.',
          ],
        },
      ],
    },

    {
      number: '3',
      title: 'Objeto de fiao',
      blocks: [
        {
          kind: 'text',
          text:
            'fiao proporciona herramientas digitales para facilitar la organización y ' +
            'administración de cuentas por cobrar.',
        },
        { kind: 'text', text: 'La Aplicación permite, entre otras funcionalidades:' },
        {
          kind: 'bullets',
          items: [
            'Registrar clientes.',
            'Registrar ventas o créditos.',
            'Consultar saldos pendientes.',
            'Registrar abonos y pagos.',
            'Consultar el historial de movimientos.',
            'Realizar búsquedas de clientes.',
            'Consultar totales y saldos de cuentas por cobrar.',
            'Facilitar la gestión y seguimiento de obligaciones pendientes.',
          ],
        },
        {
          kind: 'text',
          text:
            'fiao actúa como una herramienta de gestión y organización de información. El ' +
            'Usuario es responsable de la información que registra y de las relaciones ' +
            'comerciales que mantiene con sus clientes.',
        },
      ],
    },

    {
      number: '4',
      title: 'Registro y cuenta del Usuario',
      blocks: [
        {
          kind: 'text',
          text:
            'Para utilizar determinadas funcionalidades de fiao, el Usuario deberá crear ' +
            'una cuenta y proporcionar información verdadera, completa y actualizada.',
        },
        {
          kind: 'text',
          text:
            'El Usuario es responsable de mantener la confidencialidad de sus credenciales ' +
            'de acceso y de todas las actividades realizadas desde su cuenta.',
        },
        {
          kind: 'text',
          text:
            'El Usuario deberá informar a fiao cuando sospeche que sus credenciales han ' +
            'sido utilizadas sin autorización.',
        },
        {
          kind: 'text',
          text:
            'fiao podrá solicitar información adicional cuando sea necesaria para validar ' +
            'la identidad del Usuario, proteger la seguridad de la cuenta o cumplir ' +
            'obligaciones legales.',
        },
      ],
    },

    {
      number: '5',
      title: 'Información registrada en la Aplicación',
      blocks: [
        {
          kind: 'text',
          text:
            'El Usuario podrá registrar información de sus clientes, incluyendo, ' +
            'dependiendo de las funcionalidades disponibles:',
        },
        {
          kind: 'bullets',
          items: [
            'Nombre.',
            'Número de identificación.',
            'Número de teléfono o celular.',
            'Información relacionada con ventas a crédito.',
            'Valores adeudados.',
            'Fechas de las operaciones.',
            'Abonos y pagos.',
            'Historial de movimientos.',
            'Otra información necesaria para la gestión de las cuentas por cobrar.',
          ],
        },
        {
          kind: 'text',
          text:
            'El Usuario deberá registrar únicamente información que sea pertinente, ' +
            'necesaria y adecuada para la finalidad para la cual utiliza fiao.',
        },
      ],
    },

    {
      number: '6',
      title: 'Responsabilidad del Usuario sobre los datos de sus clientes',
      blocks: [
        {
          kind: 'text',
          text:
            'El Usuario reconoce que, al registrar información de terceros en fiao, debe ' +
            'contar con una base legal válida para realizar dicho tratamiento y cumplir ' +
            'con las obligaciones aplicables en materia de protección de datos personales.',
        },
        {
          kind: 'text',
          text:
            'El Usuario será responsable de informar a sus clientes, cuando corresponda, ' +
            'sobre el tratamiento de sus datos personales y de atender las solicitudes ' +
            'relacionadas con los derechos que la legislación aplicable les reconoce.',
        },
        {
          kind: 'text',
          text:
            'fiao no será responsable por la información que el Usuario registre de manera ' +
            'incorrecta, ilegal, desactualizada, excesiva o sin contar con la autorización ' +
            'o fundamento jurídico correspondiente.',
        },
      ],
    },

    {
      number: '7',
      title: 'Finalidades del tratamiento de datos personales',
      blocks: [
        {
          kind: 'text',
          text:
            'Los datos personales recopilados a través de fiao podrán ser tratados para ' +
            'las siguientes finalidades:',
        },
        {
          kind: 'bullets',
          items: [
            'Crear y administrar la cuenta del Usuario.',
            'Permitir el funcionamiento de las funcionalidades de la Aplicación.',
            'Identificar y autenticar al Usuario.',
            'Registrar y administrar clientes.',
            'Gestionar ventas a crédito y cuentas por cobrar.',
            'Registrar y consultar abonos y pagos.',
            'Mantener el historial de operaciones.',
            'Generar totales, saldos, estadísticas y reportes relacionados con la ' +
              'información registrada.',
            'Realizar búsquedas dentro de la información registrada.',
            'Enviar notificaciones relacionadas con el funcionamiento de la Aplicación.',
            'Brindar soporte al Usuario.',
            'Mejorar, mantener y desarrollar las funcionalidades de fiao.',
            'Detectar, prevenir y gestionar actividades fraudulentas, abusivas o no ' +
              'autorizadas.',
            'Cumplir obligaciones legales, regulatorias o requerimientos de autoridades ' +
              'competentes.',
          ],
        },
      ],
    },

    {
      number: '8',
      title: 'Tratamiento de datos personales',
      blocks: [
        {
          kind: 'text',
          text:
            'fiao realizará el tratamiento de los datos personales de acuerdo con la ' +
            'legislación colombiana aplicable en materia de protección de datos personales.',
        },
        {
          kind: 'text',
          text:
            'El tratamiento podrá incluir operaciones como recolección, almacenamiento, ' +
            'consulta, organización, actualización, uso, circulación, transmisión, ' +
            'transferencia y eliminación, según corresponda a las funcionalidades de la ' +
            'Aplicación y a las finalidades autorizadas o legalmente permitidas.',
        },
        {
          kind: 'text',
          text:
            'fiao implementará medidas razonables de carácter técnico, administrativo y ' +
            'organizacional orientadas a proteger la información contra pérdida, acceso no ' +
            'autorizado, alteración, divulgación o uso indebido.',
        },
      ],
    },

    {
      number: '9',
      title: 'Datos personales sensibles',
      blocks: [
        {
          kind: 'text',
          text:
            'fiao no solicita de manera general datos personales sensibles para el ' +
            'funcionamiento básico de la Aplicación.',
        },
        {
          kind: 'text',
          text:
            'El Usuario deberá abstenerse de registrar información sensible de sus clientes ' +
            'cuando esta no sea necesaria para la finalidad de gestión de sus cuentas por ' +
            'cobrar.',
        },
        {
          kind: 'text',
          text:
            'Si alguna funcionalidad futura requiere el tratamiento de datos sensibles, ' +
            'fiao informará previamente al Usuario y adoptará las medidas y autorizaciones ' +
            'exigidas por la legislación aplicable.',
        },
      ],
    },

    {
      number: '10',
      title: 'Datos de menores de edad',
      blocks: [
        { kind: 'text', text: 'fiao no está dirigida a menores de edad.' },
        {
          kind: 'text',
          text:
            'El Usuario deberá abstenerse de registrar información de menores de edad ' +
            'cuando no exista una finalidad legítima y una base jurídica que permita dicho ' +
            'tratamiento.',
        },
        {
          kind: 'text',
          text:
            'Cuando legalmente sea necesario, el tratamiento de datos de menores estará ' +
            'sujeto a las garantías y requisitos establecidos por la legislación colombiana.',
        },
      ],
    },

    {
      number: '11',
      title: 'Derechos de los titulares de los datos',
      blocks: [
        {
          kind: 'text',
          text:
            'De acuerdo con la legislación colombiana aplicable, los titulares de datos ' +
            'personales podrán ejercer, entre otros, los siguientes derechos:',
        },
        {
          kind: 'bullets',
          items: [
            'Conocer los datos personales que están siendo tratados.',
            'Solicitar la actualización o rectificación de sus datos.',
            'Solicitar la corrección de información incompleta, inexacta o desactualizada.',
            'Solicitar información sobre el uso dado a sus datos.',
            'Solicitar la supresión de sus datos cuando sea procedente.',
            'Revocar la autorización para el tratamiento cuando sea legalmente procedente.',
            'Presentar consultas o reclamos relacionados con el tratamiento de sus datos.',
            'Acceder gratuitamente a sus datos personales en los casos establecidos por la ' +
              'ley.',
          ],
        },
      ],
    },

    {
      number: '12',
      title: 'Consultas y reclamos',
      blocks: [
        {
          kind: 'text',
          text:
            'El titular de los datos personales podrá presentar consultas o reclamos ' +
            'relacionados con el tratamiento de sus datos personales a través del correo ' +
            'electrónico: soporte@elfiao.com',
        },
        {
          kind: 'text',
          text:
            'La solicitud deberá contener, como mínimo, la identificación del titular, una ' +
            'descripción clara de la solicitud y los datos de contacto necesarios para ' +
            'recibir respuesta.',
        },
        {
          kind: 'text',
          text:
            'fiao atenderá las consultas y reclamos dentro de los términos establecidos por ' +
            'la legislación colombiana aplicable.',
        },
      ],
    },

    {
      number: '13',
      title: 'Conservación de la información',
      blocks: [
        {
          kind: 'text',
          text:
            'fiao conservará los datos personales durante el tiempo que resulte necesario ' +
            'para cumplir las finalidades para las cuales fueron recopilados, atender ' +
            'obligaciones legales, resolver posibles controversias y cumplir otros deberes ' +
            'legítimos relacionados con la prestación del servicio.',
        },
        {
          kind: 'text',
          text:
            'Cuando la información ya no sea necesaria para dichas finalidades y no exista ' +
            'una obligación legal de conservarla, podrá ser eliminada, anonimizada o ' +
            'sometida a las medidas que correspondan.',
        },
      ],
    },

    {
      number: '14',
      title: 'Seguridad de la información',
      blocks: [
        {
          kind: 'text',
          text:
            'fiao implementará medidas de seguridad razonables para proteger la información ' +
            'almacenada en sus sistemas.',
        },
        {
          kind: 'text',
          text:
            'Sin embargo, el Usuario reconoce que ningún sistema tecnológico puede ' +
            'garantizar una seguridad absoluta.',
        },
        {
          kind: 'text',
          text:
            'El Usuario también deberá adoptar medidas razonables para proteger sus ' +
            'credenciales, dispositivos y acceso a la Aplicación.',
        },
      ],
    },

    {
      number: '15',
      title: 'Proveedores tecnológicos',
      blocks: [
        {
          kind: 'text',
          text:
            'Para operar fiao, determinados servicios tecnológicos podrán ser prestados por ' +
            'terceros especializados, incluyendo proveedores de infraestructura, ' +
            'almacenamiento, bases de datos, autenticación, comunicaciones, analítica u ' +
            'otros servicios necesarios para el funcionamiento de la Aplicación.',
        },
        {
          kind: 'text',
          text:
            'Cuando sea necesario compartir o transmitir información a dichos proveedores, ' +
            'fiao procurará establecer las medidas contractuales, técnicas y ' +
            'organizacionales correspondientes para proteger los datos personales y ' +
            'limitar su tratamiento a las finalidades aplicables.',
        },
      ],
    },

    {
      number: '16',
      title: 'Información de contacto',
      blocks: [
        {
          kind: 'text',
          text:
            'El Usuario y los titulares de datos podrán utilizar los canales oficiales ' +
            'habilitados por fiao para realizar consultas, solicitudes, reclamos o ejercer ' +
            'sus derechos relacionados con el tratamiento de datos personales.',
        },
        { kind: 'text', text: 'Correo electrónico: soporte@elfiao.com' },
        { kind: 'text', text: 'Sitio web: https://elfiao.com/' },
      ],
    },

    {
      number: '17',
      title: 'Uso adecuado de la Aplicación',
      blocks: [
        {
          kind: 'text',
          text:
            'El Usuario se compromete a utilizar fiao de manera lícita, responsable y ' +
            'conforme a estos Términos y Condiciones.',
        },
        { kind: 'text', text: 'Está prohibido utilizar la Aplicación para:' },
        {
          kind: 'bullets',
          items: [
            'Registrar información falsa o fraudulenta.',
            'Utilizar información de terceros sin una base legal válida.',
            'Realizar actividades ilícitas.',
            'Amenazar, acosar o intimidar a otras personas.',
            'Intentar acceder a cuentas o información de otros usuarios.',
            'Alterar, interferir o comprometer el funcionamiento de la Aplicación.',
            'Utilizar la Aplicación para actividades que vulneren derechos de terceros.',
          ],
        },
      ],
    },

    {
      number: '18',
      title: 'Información sobre deudas y cuentas por cobrar',
      blocks: [
        {
          kind: 'text',
          text:
            'La información registrada en fiao corresponde a los datos proporcionados por ' +
            'el Usuario.',
        },
        {
          kind: 'text',
          text:
            'fiao no determina por sí misma la existencia, validez, exigibilidad o cuantía ' +
            'de una obligación entre el Usuario y sus clientes.',
        },
        {
          kind: 'text',
          text:
            'La información mostrada en la Aplicación se genera a partir de los registros ' +
            'realizados por el Usuario.',
        },
        {
          kind: 'text',
          text:
            'El Usuario es responsable de verificar que los valores, fechas, abonos y ' +
            'demás información registrada sean correctos.',
        },
      ],
    },

    {
      number: '19',
      title: 'Limitación de responsabilidad',
      blocks: [
        {
          kind: 'text',
          text:
            'fiao proporciona una herramienta tecnológica para facilitar la gestión de ' +
            'información comercial.',
        },
        {
          kind: 'text',
          text:
            'fiao no garantiza que la utilización de la Aplicación produzca el pago de las ' +
            'obligaciones registradas, ni interviene necesariamente en las relaciones ' +
            'comerciales entre el Usuario y sus clientes.',
        },
        {
          kind: 'text',
          text:
            'El Usuario será responsable de las decisiones comerciales, financieras o de ' +
            'cobro que adopte utilizando la información disponible en la Aplicación.',
        },
      ],
    },

    {
      number: '20',
      title: 'Disponibilidad del servicio',
      blocks: [
        {
          kind: 'text',
          text:
            'fiao procurará mantener la Aplicación disponible y funcionando correctamente.',
        },
        {
          kind: 'text',
          text:
            'Sin embargo, pueden presentarse interrupciones ocasionadas por mantenimiento, ' +
            'actualizaciones, fallas técnicas, problemas de conectividad, servicios de ' +
            'terceros, eventos de fuerza mayor u otras circunstancias fuera del control ' +
            'razonable de fiao.',
        },
        {
          kind: 'text',
          text:
            'fiao podrá realizar actualizaciones, modificaciones o mejoras a la Aplicación ' +
            'cuando lo considere necesario.',
        },
      ],
    },

    {
      number: '21',
      title: 'Modificaciones',
      blocks: [
        {
          kind: 'text',
          text:
            'fiao podrá actualizar estos Términos y Condiciones y su Política de ' +
            'Tratamiento de Datos Personales cuando resulte necesario.',
        },
        {
          kind: 'text',
          text:
            'Cuando los cambios sean relevantes, se procurará informar al Usuario a través ' +
            'de los canales disponibles.',
        },
        {
          kind: 'text',
          text:
            'El uso continuado de la Aplicación después de la entrada en vigencia de las ' +
            'modificaciones podrá considerarse como aceptación de los términos ' +
            'actualizados, cuando legalmente corresponda.',
        },
      ],
    },

    {
      number: '22',
      title: 'Terminación de la cuenta',
      blocks: [
        {
          kind: 'text',
          text:
            'El Usuario podrá solicitar la cancelación de su cuenta de acuerdo con los ' +
            'mecanismos habilitados por fiao.',
        },
        {
          kind: 'text',
          text:
            'fiao podrá suspender o cancelar una cuenta cuando exista incumplimiento de ' +
            'estos Términos y Condiciones, uso fraudulento, actividad ilícita, riesgos de ' +
            'seguridad o cuando resulte necesario para proteger la Aplicación, a sus ' +
            'usuarios o cumplir obligaciones legales.',
        },
      ],
    },

    {
      number: '23',
      title: 'Propiedad intelectual',
      blocks: [
        {
          kind: 'text',
          text:
            'La Aplicación, su diseño, marca, logotipos, código, interfaces, contenidos, ' +
            'funcionalidades y demás elementos asociados a fiao pertenecen a sus ' +
            'respectivos titulares y se encuentran protegidos por las normas aplicables de ' +
            'propiedad intelectual.',
        },
        {
          kind: 'text',
          text:
            'El uso de fiao no concede al Usuario derechos de propiedad sobre la ' +
            'Aplicación ni sobre sus elementos.',
        },
      ],
    },

    {
      number: '24',
      title: 'Aceptación',
      blocks: [
        {
          kind: 'text',
          text: 'Al crear una cuenta, acceder o utilizar fiao, el Usuario declara que:',
        },
        {
          kind: 'bullets',
          items: [
            'Ha leído estos Términos y Condiciones.',
            'Comprende su contenido.',
            'Acepta las condiciones de uso de la Aplicación.',
            'Comprende las condiciones relacionadas con el tratamiento de datos personales.',
            'Se compromete a utilizar fiao de manera lícita y responsable.',
          ],
        },
      ],
    },

    {
      number: '25',
      title: 'Legislación aplicable',
      blocks: [
        {
          kind: 'text',
          text:
            'Estos Términos y Condiciones se regirán e interpretarán de conformidad con ' +
            'las leyes aplicables de la República de Colombia.',
        },
        {
          kind: 'text',
          text:
            'Cualquier controversia relacionada con estos términos será atendida de ' +
            'acuerdo con los mecanismos y autoridades competentes establecidos por la ' +
            'legislación colombiana.',
        },
      ],
    },

    {
      number: '26',
      title: 'Vigencia',
      blocks: [
        {
          kind: 'text',
          text:
            'Los presentes Términos y Condiciones y la Política de Tratamiento de Datos ' +
            'Personales se encuentran vigentes a partir del 14 de octubre de 2026 y ' +
            'permanecerán vigentes mientras el Usuario utilice fiao, salvo que sean ' +
            'modificados o reemplazados conforme a las disposiciones aquí establecidas.',
        },
      ],
    },
  ],

  contact: {
    name: 'fiao',
    tagline: 'Organiza tus cuentas por cobrar de forma fácil y segura.',
    website: 'https://elfiao.com/',
    email: 'soporte@elfiao.com',
  },
};
