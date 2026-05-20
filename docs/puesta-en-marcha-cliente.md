# Puesta en marcha del asistente de WhatsApp — Guía para el cliente

Hola 👋 Para activar el asistente automático de WhatsApp de **The Rehab Studio**
necesito que me consigas unas pocas cosas. Esta guía lo explica **paso a paso y
sin tecnicismos**. Si sigues estos pasos, no tendrás que hacer nada más: del
resto (servidores, base de datos, conexiones) me encargo yo.

Son **4 bloques**:

1. WhatsApp oficial de Meta (el número del bot)
2. DeepSeek (el "cerebro" que entiende a los pacientes)
3. Google Calendar (tu agenda)
4. Datos de la clínica (un pequeño formulario)

Tiempo aproximado: **30–45 minutos** repartidos (la verificación de Meta tarda
unos días, pero eso va por su cuenta).

---

## BLOQUE 1 — WhatsApp oficial (Meta)

El bot funciona con la plataforma oficial de WhatsApp para empresas. Hay que dar
de alta tu negocio en Meta una sola vez.

### 1.1 Decide el número del bot ⚠️ (decisión importante)

El número que use el bot tiene reglas:

- Tiene que poder **recibir un SMS o una llamada** (para verificarlo).
- **No puede estar usándose en la app de WhatsApp** (ni la normal ni la Business).
  Si conectas un número que ya usas en la app, **dejarás de poder abrir WhatsApp
  en ese número**.

Por eso te recomiendo:

- ✅ **Usar un número NUEVO solo para el bot** (una SIM nueva o un número virtual).
  Así conservas tu WhatsApp de siempre para hablar tú a mano con los pacientes.

> 👉 Consigue ese número nuevo antes de seguir. (Tu WhatsApp personal seguirá
> funcionando igual; el bot usará el nuevo.)

### 1.2 Crea tu cuenta de empresa en Meta

1. Entra en **https://business.facebook.com** con tu cuenta de Facebook.
   (Si no tienes Facebook, créate una cuenta; sirve cualquiera.)
2. Crea un **"Portafolio empresarial"** (Business Portfolio) con el nombre de la
   clínica.

### 1.3 Inicia la verificación del negocio

Meta exige verificar que el negocio es real. Necesitarás tener a mano:

- Nombre legal (autónomo o empresa)
- Dirección
- NIF / CIF
- Web o redes de la clínica
- Un documento que acredite el negocio (alta de autónomo, factura de un
  suministro a nombre del negocio, etc.)

Pasos:

1. Dentro de business.facebook.com → **Configuración del negocio** (el icono de
   engranaje).
2. Busca **Centro de seguridad** → **Iniciar verificación del negocio**.
3. Rellena los datos y sube el documento.
4. La aprobación tarda normalmente **entre 1 y 7 días**. Puedes seguir con el
   resto de la guía mientras tanto.

### 1.4 Dame acceso (así lo configuro yo y tú no tocas nada técnico)

1. **Configuración del negocio → Usuarios → Personas → Añadir**.
2. Escribe mi correo: **[PON_AQUÍ_MI_CORREO]**
3. Dame el rol de **Administrador**.
4. Acepta y envía la invitación.

### 1.5 Lee el código cuando te lo pida

Cuando yo conecte el número del bot, te llegará un **código por SMS o llamada** a
ese número. Solo tienes que **pasármelo**. Eso es todo lo que harás en este
bloque.

---

## BLOQUE 2 — DeepSeek (el cerebro del asistente)

El bot usa una inteligencia artificial llamada DeepSeek para entender y responder
a los pacientes. Es muy barata (céntimos por conversación), pero hay que crear una
cuenta y meter un poco de saldo.

1. Entra en **https://platform.deepseek.com** y regístrate (con email o con
   Google).
2. Ve a la sección de **facturación / "Billing"** y añade un saldo inicial
   pequeño (con **5 €/$** sobra para empezar muchísimo tiempo).
3. Ve a **API Keys** (**https://platform.deepseek.com/api_keys**) → **Create new
   API key**.
4. Ponle un nombre cualquiera (ej. "rehab-bot") y **copia la clave** que empieza
   por `sk-...`.
   - ⚠️ Solo se muestra una vez. Cópiala bien.
5. Pásame esa clave.

> Esta cuenta queda a tu nombre, así que el gasto de la IA es tuyo y siempre
> tienes el control. Si prefieres que lo gestione yo, dímelo y me encargo.

---

## BLOQUE 3 — Google Calendar (tu agenda)

El bot crea, mueve y cancela las citas directamente en tu Google Calendar, que es
la agenda "oficial". Tu parte aquí es **mínima**.

1. Decide **qué cuenta de Google** tendrá la agenda de la clínica:
   - Puede ser tu Gmail actual, o
   - Una cuenta de Google nueva solo para la clínica (recomendado si quieres
     separar lo personal de lo profesional).
2. Dime cuál es ese correo de Google.
3. Yo prepararé la conexión y **te enviaré un enlace**.
4. Tú **abres ese enlace**, inicias sesión con esa cuenta de Google y pulsas
   **"Permitir"**. Listo.

> No tienes que configurar nada en Google tú; solo autorizar con un clic cuando te
> pase el enlace.

---

## BLOQUE 4 — Datos de la clínica (formulario)

Cópiame esto rellenado:

```
- Nombre comercial de la clínica:        (ej. The Rehab Studio)
- Dirección completa:                     (ej. Calle Ejemplo 1, Madrid)
- Zona horaria:                           (por defecto: Europe/Madrid)
- TU teléfono personal como fisio:        (formato +34XXXXXXXXX)
      (ESTE es tu WhatsApp de siempre, donde el bot te avisará y te
       reenviará las preguntas de los pacientes. NO es el número del bot.)
- Tu email:                               (para avisos)
- Precio por sesión (€):                  (ej. 60)
- Precio seguimiento (€):                 (ej. 30)
- Tu horario de atención semanal:         (ej. L-V 9:00-14:00 y 16:00-20:00,
                                           sábados 10:00-13:00)
```

> Ojo: tu teléfono personal de fisio y el número del bot son **dos números
> distintos**. Tú sigues usando el tuyo normal; el bot vive en el nuevo. Cuando un
> paciente haga una pregunta médica, el bot te la reenviará a tu WhatsApp normal y
> tú respondes ahí; el bot le traslada tu respuesta al paciente.

---

## RESUMEN — tu checklist

- [ ] **WhatsApp:** conseguir un número nuevo para el bot
- [ ] **WhatsApp:** crear el portafolio en business.facebook.com
- [ ] **WhatsApp:** iniciar la verificación del negocio (con tus datos legales)
- [ ] **WhatsApp:** añadirme como administrador ([PON_AQUÍ_MI_CORREO])
- [ ] **WhatsApp:** pasarme el código de verificación cuando te lo pida
- [ ] **DeepSeek:** crear cuenta, meter ~5 € de saldo y pasarme la clave `sk-...`
- [ ] **Google:** decirme el correo de Google de la agenda y autorizar con el
      enlace que te envíe
- [ ] **Datos clínica:** enviarme el formulario del Bloque 4 relleno

Cuando tengas todo esto, yo conecto las piezas y lo dejo funcionando. Cualquier
duda en cualquier paso, escríbeme. 🙌
