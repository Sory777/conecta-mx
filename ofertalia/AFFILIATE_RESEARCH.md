# OFERTALIA — Investigación del ecosistema de afiliación (México + internacional)

> Documento interno. Fecha de corte: **4 de octubre de 2026**.
> Objetivo: decidir qué fuentes integrar, en qué orden y bajo qué condiciones, **sin inventar programas, comisiones ni APIs**.

---

## 0. Cómo leer este documento (importante)

### 0.1 Metodología y limitaciones

- La investigación se hizo con búsquedas web. **El acceso directo a los portales oficiales de afiliados (afiliados.amazon.com.mx, awin.com, admitad.com, flexoffers.com, affi.io, etc.) estuvo bloqueado** desde el entorno donde se hizo la investigación, así que no se pudo leer en vivo ninguna tabla oficial de comisiones.
- Por eso **cada dato lleva un nivel de confianza**. Las comisiones que aparecen son **las que se reportan públicamente** y **hay que confirmarlas en el panel de cada red una vez aprobada la cuenta** antes de mostrarlas o usarlas en proyecciones.
- Las comisiones y las condiciones cambian a menudo. En la base de datos, todo programa tendrá `verified_at` y `source_url`; nada se considera "vigente" sin verificación manual.

### 0.2 Nivel de confianza

| Nivel | Significado |
|---|---|
| **A** | Fuente oficial de la empresa (sala de prensa, documentación de developers, página del programa) o prensa de negocios que cita a la empresa. |
| **B** | Directorios de afiliación de terceros (FlexOffers, affi.io, Affilitizer, UpPromote, Travelpayouts, etc.) o reseñas especializadas. Es probable, pero hay que verificarlo. |
| **C** | Indicio débil (una sola mención secundaria, datos viejos o contradictorios). **No se debe asumir que el programa existe.** |

### 0.3 Estados de integración

| Estado | Significado |
|---|---|
| ✅ **P1** | Integrar primero (Fase MVP). |
| 🟡 **Viable** | El programa existe y es útil; hay que solicitar ingreso y esperar aprobación. |
| 🔍 **Verificar** | Solo hay evidencia de terceros; hay que confirmar que existe para México y en qué red está. |
| ✋ **Integración manual/revisión requerida** | No hay API ni feed (o no está autorizado automatizar); solo se integra a mano o por acuerdo directo. |
| ⛔ **No monetizable** | No se encontró programa de afiliados (o se cerró). Se puede listar la oferta **sin** enlace afiliado o no listarla. |

### 0.4 Abreviaturas

- **CPS**: costo por venta (% de la venta). **CPA**: pago por acción. **CPL**: pago por lead. **CPC**: pago por clic. **RevShare**: % del ingreso del comerciante.
- **Cookie**: ventana de atribución tras el clic.
- **KYC/Fiscal**: identidad, RFC/constancia fiscal, cuenta bancaria, formularios fiscales (p. ej. W-8BEN para redes de EE. UU.).

---

## 1. Redes de afiliación (la "infraestructura")

Lo más eficiente es **integrar redes, no tiendas sueltas**: una sola API de red da acceso a decenas o cientos de comerciantes, con deep links, feeds y reportes de conversiones.

| Red | Presencia MX | Anunciantes relevantes (evidencia) | API / Feed | Deep link | Modelos | Requisitos | Conf. | Estado |
|---|---|---|---|---|---|---|---|---|
| **Awin** | Anunció expansión a México en jun‑2025 y la reforzó en ago‑2026 | Booking.com (Awin es la vía para LATAM/NA), Xcaret (perfil de comerciante), Nike (perfil en Awin), Sephora (marca global en Awin), Trip.com | Sí: API para publishers, feeds de productos y link builder (documentados de forma pública por Awin) | Sí | CPS, CPL | Aprobación de la red y además aprobación por anunciante; datos de pago | A | ✅ P1 |
| **Admitad** | Tiene una "store" de México con **~230 anunciantes** | Coppel (cookie de 60 días), PriceTravel (cookie de 7 días) | Sí: API, generador de deep links, feeds y cupones | Sí | CPA, CPL, CPI, RevShare | Aprobación por programa; acepta cashback y loyalty como tipos de espacio (depende de cada anunciante) | A/B | ✅ P1 |
| **Impact (impact.com)** | Se reporta como la plataforma #1 por cuota en México (dato de terceros) | Adidas (incluye MX), Airalo, Skyscanner, Canva, Udemy, Surfshark | Sí: API de partners y catálogos | Sí | CPS, CPA, CPC según la marca | Aprobación por marca; datos fiscales | B | ✅ P1 |
| **Soicos** | Red latinoamericana con oficina en México (Naucalpan) | Elektra (3.15%), Aeroméxico, Palacio de Hierro (reportado); sus clientes incluyen Amazon, Amex, BBVA, eBay, Movistar | Por confirmar | Por confirmar | CPS, CPL | Aprobación | A (empresa) / B (anunciantes) | 🟡 Viable |
| **Rakuten Advertising** | Atiende LATAM; no se confirmó ningún anunciante mexicano concreto | Promodescuentos la menciona entre las redes que usa en MX | Sí (API global) | Sí | CPS | Aprobación | B | 🔍 Verificar |
| **CJ (Commission Junction)** | Global | Booking.com (Europa), Rentalcars | Sí | Sí | CPS | Aprobación | B | 🟡 Viable |
| **FlexOffers** | Sub-red que agrega programas MX y paga en USD | Lenovo MX, Coppel MX, Home Depot MX, Barceló MX, Aeroméxico MX, Samsung MX, Walmart MX (marcado como "no disponible actualmente") | Sí | Sí | CPS, CPL | Aprobación; pagos en USD | B | 🟡 Viable (agregador de respaldo) |
| **Travelpayouts** | Global, especializada en viajes | Aviasales, Kiwi.com (~3%), Trip.com (~1% vuelos), Klook, GetYourGuide, Booking (según su directorio) | **Sí: APIs y feeds de datos (precios de vuelos, etc.) por marca** | Sí | CPS | Registro abierto; algunas marcas piden aprobación | A/B | ✅ P1 (vuelos) |
| **Partnerize** | Global | Apple Services (Performance Partners) | Sí | Sí | CPS | Aprobación de Apple | A | 🟡 Viable (bajo valor) |
| **TradeDoubler** | Global | Aeroméxico (reportado) | Sí | Sí | CPS | Aprobación | C | 🔍 Verificar |
| **Webgains** | Global (UE) | Hoteles Xcaret (UK) | Sí | Sí | CPS | Aprobación | B | 🔍 (preferir Awin o el programa directo de Xcaret) |
| **Daisycon** | UE | Eneba (INT) | Sí | Sí | RevShare | Aprobación | B | 🔍 Verificar aceptación de tráfico MX |
| **Hotmart** | Fuerte en LATAM/MX | Infoproductos (cursos) | Sí | Sí | CPS (hasta 80%, lo fija el productor) | Registro abierto | A | ✋ Revisión por producto (calidad variable, riesgo reputacional) |

**Conclusión de redes:** el núcleo inicial debe ser **Awin + Admitad + Impact + Travelpayouts**, más los programas directos de **Amazon** y **Mercado Libre**. Soicos y FlexOffers sirven para cubrir marcas mexicanas que no estén en las anteriores.

**Evidencia de que el modelo funciona en MX:** Promodescuentos (parte de Pepper.com, la mayor comunidad de ofertas de México) declara públicamente que trabaja con **Awin, Soicos, Rakuten Advertising e Impact** y que tiene acuerdos directos con Mercado Libre, Walmart, Samsung, Barceló, Volaris y Sam's Club; además es afiliado de Amazon. Es el competidor de referencia.

---

## 2. Tabla maestra por empresa

Columnas pedidas: Empresa | Categoría | País | Programa afiliados | Red | API/Feed | Deep Link | Comisión | Cookie/Atribución | Requisitos | Estado. Se añade **Conf.** (confianza).

### 2.1 Marketplaces y tiendas generalistas

| Empresa | Categoría | País | Programa afiliados | Red | API/Feed | Deep Link | Comisión (reportada) | Cookie/Atribución | Requisitos | Conf. | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Amazon México** | Generalista | MX | Sí: Amazon Afiliados | Directo | **Creators API** (sustituye a PA‑API 5.0, que se retiró entre el 30‑abr y el 15‑may‑2026). Disponible para el marketplace MX (es_MX, MXN). **Requiere 10 ventas calificadas en los últimos 30 días** | Sí (tag de afiliado / SiteStripe) | 1%–10% según categoría | 24 h según reportes (verificar la regla del carrito en MX) | Aprobación definitiva tras ventas iniciales; datos fiscales; pago mínimo reportado de $1,000 MXN. **Reglas clave del Operating Agreement (verificar el texto MX):** solo mostrar precios obtenidos vía API y actualizados; no usar enlaces en email/PDF/offline | A (API) / B (comisiones) | ✅ P1 |
| **Mercado Libre** | Generalista | MX (también AR, BR, CO, CL) | Sí: Programa de Afiliados y Creadores (MX desde 2024) | Directo | **No hay API de afiliados pública.** La API pública de búsqueda de ML **fue restringida** | Sí, pero **solo** para páginas de producto y listas permitidas. **No se permite** enlazar: página principal, "Ofertas del día", páginas de categoría, carrito, tiendas de vendedores, etc. | 12%–22% por categoría (hay reportes de hasta 24%) | No publicada | Cuenta de ML, mayor de 18, **no ser vendedor en ML**, audiencia propia (se reportan ≥1,000 seguidores), pagos vía Mercado Pago (hasta ~60 días) | A (prensa) / B | ✅ P1, con integración **✋ semimanual** (generar enlaces en su herramienta) |
| **AliExpress** | Generalista / importación | Global (envía a MX) | Sí: AliExpress Portals | Directo | Sí: API de afiliados en su Open Platform (consulta de productos y generación de enlaces) | Sí | 3%–9% promedio; bonos en "Hot Products" y usuarios nuevos | Por confirmar | Registro; validación de ~60 días antes del pago | B | 🟡 Viable |
| **Temu** | Generalista / importación | MX | Sí: programa propio (con versión MX) | Directo | No se encontró API pública | Enlaces/códigos de referido | Estructura MX reportada en 2024: 10%/20%/30% según monto + MX$100 por usuario nuevo (cambia a menudo) | Por confirmar | Registro en app; condiciones cambiantes | B (2024) | ✋ Revisión requerida (condiciones volátiles; validar calidad/reputación) |
| **Shein** | Moda rápida | MX entre los países aprobados | Sí | Varias redes (por confirmar cuál para MX) | Se reportan feeds de producto | Sí | 8%–12% reportado | 30 días | Aprobación | B | 🔍 Verificar |
| **Walmart México** | Supermercado / generalista | MX | Hubo programa (tabla por categoría 3.2%–8%) | FlexOffers lo marca **"no disponible actualmente"** | – | – | 3.2%–8% (histórico) | 10 días (histórico) | – | B | 🔍 Verificar si sigue activo (Promodescuentos menciona acuerdo directo) |
| **Coppel** | Departamental / electrónica / crédito | MX | Sí | Admitad (cookie 60 días); FlexOffers (4.32%) | Feeds vía red (por confirmar) | Sí | ~4.32% (FlexOffers) | 60 días (Admitad) | Aprobación | B | 🟡 Viable |
| **Liverpool** | Departamental | MX | Solo una mención débil como "top programa MX" | No identificada | – | – | – | – | – | C | 🔍 Verificar (contacto directo) |
| **El Palacio de Hierro** | Departamental premium | MX | Sí (reportado) | FlexOffers (1.28%), Soicos y otras | Por confirmar | Sí | 1.28%–10% (datos contradictorios) | 30 días | Ventas en app excluidas | B | 🔍 Verificar |
| **Elektra** | Electrónica / línea blanca | MX | Sí | Soicos (activo); FlexOffers (cerrado) | Por confirmar | Sí | 3.15% | 15–30 días | Ventas en kiosco excluidas; validación 30 días tras cierre de mes | B | 🟡 Viable |
| **The Home Depot México** | Hogar / herramientas | MX | Sí | 2 redes activas reportadas (incl. FlexOffers) | Por confirmar | Sí | 1.96% | 30 días | Aprobación | B | 🟡 Viable |
| **Dormimundo** | Colchones / muebles | MX | Listado en directorio | Por confirmar | – | – | – | – | – | C | 🔍 Verificar |
| **Waldo's** | Variedades | MX | Listado (FlexOffers) | FlexOffers | – | – | – | – | – | C | 🔍 Verificar |
| **Sam's Club** | Mayoreo | **EE. UU.** (programa en Rakuten). MX: acuerdo directo con Promodescuentos | Rakuten (US) | – | – | US: 12% membresías, 2.4% general | 3 días (US) | – | B | 🔍 Para MX, solo contacto directo |
| Claro Shop, Sanborns, Sears, Office Depot, Soriana, Chedraui, Costco MX, Bodega Aurrera, Suburbia | Retail MX | MX | **No se encontró evidencia** de programa de afiliados | – | – | – | – | – | – | – | ⛔ / ✋ (contacto comercial directo más adelante) |

### 2.2 Tecnología, celulares, computadoras y videojuegos

| Empresa | Categoría | País | Programa afiliados | Red | API/Feed | Deep Link | Comisión (reportada) | Cookie | Requisitos | Conf. | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Samsung México** | Celulares / TV / línea blanca | MX | Sí: **Samsung Affiliate Program / Club Samsung** (oficial, CPS, desde nov‑2024; >30% de ventas de la tienda oficial en ciertos momentos) | Programa propio + redes (FlexOffers lo lista) | Por confirmar | Sí | 2.60%–4.64% | 30 días | Aprobación | A (programa) / B (%) | ✅ P1 |
| **Lenovo México** | Laptops / PC | MX | Sí | FlexOffers | Feed por confirmar | Sí | 1.6%–7.2% + US$36 por lead B2B | **3 días** | Aprobación | B | 🟡 Viable |
| **Cyberpuerta** | Electrónica / componentes PC | MX | Sí (activo según directorios) | Por confirmar | Por confirmar | Sí | No pública | 30 días | Aprobación | B | 🟡 Viable (alto encaje con el público "tech") |
| **Apple** | Solo servicios (Music, TV, Books, Podcasts) | MX incluido | Sí: Apple Performance Partners | Partnerize | Sí | Sí | No pública aquí | – | Aprobación de Apple. **No cubre hardware** (iPhone/Mac) | A | 🟡 Bajo valor |
| **Eneba** | Llaves de videojuegos | Internacional | Sí | Daisycon (INT) / otras | Por confirmar | Sí | 2%–5% RevShare | 30 días | Aprobación; verificar región MX y licencias | B | 🔍 Verificar |
| **Green Man Gaming** | Videojuegos digitales (distribuidor oficial) | Internacional | Sí | Varias | Sí (feeds en redes) | Sí | 2%–10% | 30 días | Aprobación | B | 🟡 Viable |
| Steren, DDTech, PCEL, Motorola, Xiaomi, HP, Dell MX, PlayStation, Xbox, Nintendo | Tech | MX | **No se encontró evidencia** de programa MX | – | – | – | – | – | – | – | 🔍 / ⛔ |

### 2.3 Moda, calzado, belleza y deportes

| Empresa | Categoría | País | Programa | Red | API/Feed | Deep Link | Comisión (reportada) | Cookie | Requisitos | Conf. | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Nike México** | Calzado / deportes | MX (distribución en manos de Grupo Axo) | Sí | Awin (perfil) / FlexOffers | **Feed de producto** actualizado (reportado) | Sí | 4%–9% (datos contradictorios) | 30 días | Aprobación | B | 🟡 Viable |
| **Adidas México** | Calzado / deportes | MX incluido | Sí | Impact | Catálogo vía Impact | Sí | 5.6% general; 8% en líneas puntuales (MX) | 30 días | Aprobación | B | 🟡 Viable |
| **Sephora México** | Belleza | MX | Programa MX listado en directorios; Sephora es marca global de Awin | Awin (por confirmar en MX) | Por confirmar | Sí | 5%–10% (en otros países) | 30 días (ES) | Aprobación | B/C | 🔍 Verificar |
| **Shein** | Moda | MX | Ver 2.1 | | | | | | | | 🔍 |
| Zara/Inditex, H&M, Liverpool moda, Puma, Under Armour, Innovasport, Martí | Moda / deporte | MX | **No se encontró evidencia** de programa MX | – | – | – | – | – | – | – | 🔍 / ⛔ |

### 2.4 Viajes: hoteles, vuelos, paquetes, autos y experiencias

| Empresa | Categoría | País | Programa | Red | API/Feed | Deep Link | Comisión (reportada) | Cookie | Requisitos | Conf. | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Booking.com** | Hoteles / autos / atracciones | Global | Sí. **Desde jun‑2025 ya no hay programa directo**; se migró a redes | **Awin** (LATAM, NA, APAC) / CJ (Europa) | Widgets y deep links; **la API se habilita por volumen** | Sí | 4% estancias completadas, 6% autos, 4% atracciones, ~€2 por vuelo (reporte CJ) | Por confirmar | Aprobación en la red; se paga solo por **estancia completada** | A (migración) / B (%) | ✅ P1 |
| **Expedia Group** (Expedia, Hoteles.com, Vrbo) | Hoteles / vuelos / paquetes / rentas vacacionales | Global | Sí: **Travel Creator Program** (una sola cuenta para las 3 marcas) | Directo (Hotels.com también vía CJ) | Creator Toolbox, widgets de ofertas, **data feeds** | Sí | Desde ~4% (Hotels.com hasta 6%–6.4% según directorios) | 30 días (reportado) | Aprobación | A (programa) / B (%) | ✅ P1 |
| **Despegar** (incl. **Best Day**) | OTA líder LATAM: vuelos, hoteles, paquetes, autos, actividades | MX/LATAM | Sí: **Despegar Partner Hub** | Directo | Por confirmar | Por confirmar | No pública | Por confirmar | Aprobación | A (existe) / – | 🟡 Viable (prioritario por relevancia en MX) |
| **PriceTravel** | OTA mexicana | MX | Sí | Admitad | Por confirmar | Sí | Por confirmar | **7 días** | Aprobación | B | 🟡 Viable |
| **Trip.com** | Hoteles / vuelos / tours | Global | Sí | Directo / Travelpayouts / Awin / Involve Asia | Sí (según red) | Sí | 1%–7% según red y producto | 30 días | Aprobación | B | 🟡 Viable |
| **Agoda** | Hoteles | Global | Sí: Agoda Partners | Directo | **Sí: API y data feeds (Hotel Power Ads)** | Sí | 4% → 4.5% → 5% por volumen (hasta 7%) | Por confirmar | Aprobación | B | 🟡 Viable |
| **Aviasales / Travelpayouts** | Metabuscador de vuelos | Global | Sí | Travelpayouts | **Sí: API de datos de precios de vuelos** | Sí | ~1.1%–1.5% de la reserva (vuelos) | Por confirmar | Registro | A/B | ✅ P1 (fuente de datos de vuelos) |
| **Kiwi.com** | Vuelos | Global | Sí | Travelpayouts | Sí (vía red) | Sí | ~3% | Por confirmar | Registro | B | 🟡 Viable |
| **Skyscanner** | Metabuscador | Global | Sí | Impact | Widgets; API para partners aprobados | Sí | RevShare (base reportada 20% del ingreso de Skyscanner) o CPC | 30 días | **Aprobación moderada** | B | 🟡 Viable |
| **Kayak** | Metabuscador | Global | Sí | Varias | Por confirmar | Sí | CPC por click-out (reportado) | – | Aprobación; verificar MX | B | 🔍 Verificar |
| **Aeroméxico** | Aerolínea | MX | Sí (reportado) | FlexOffers / TradeDoubler / Soicos | Por confirmar | Sí | Hasta ~2% | 15–30 días | Aprobación | B | 🟡 Viable |
| **Volaris / Viva Aerobus** | Aerolíneas low cost | MX | **No se encontró programa público.** Promodescuentos reporta acuerdo directo con Volaris | – | – | – | – | – | – | – | ✋ Acuerdo directo (más adelante) |
| **Grupo Xcaret** | Parques / hoteles / tours (Quintana Roo) | MX | Sí: programa propio + redes | **Awin** (perfil "Xcaret Global"), Webgains, directo (xcaret.com/en/affiliates) | Por confirmar | Sí | **6% parques, hoteles y tours; 4% ferris (Xailing)** | 30 días | Aprobación. **Prohibido SEM con su marca** y siteunder | B | ✅ P1 (marca mexicana fuerte y comisión clara) |
| **Barceló Hotels** | Hoteles | MX (programa MX) | Sí | FlexOffers | Por confirmar | Sí | 4.8% | Por confirmar | Aprobación | B | 🟡 Viable |
| RIU, Iberostar, Palace Resorts, Marriott, Hilton, Posadas | Hoteles | MX | **No se encontró evidencia** de programa MX | – | – | – | – | – | – | – | 🔍 |
| **Airbnb** | Rentas vacacionales | Global | **No. Cerró su programa en 2021**; solo hay referidos con crédito de viaje | – | – | – | – | – | – | A | ⛔ (usar Vrbo vía Expedia) |
| **GetYourGuide** | Tours y actividades | Global | Sí | Directo / Travelpayouts | Widgets, SmartLinks (API para partners: por confirmar) | Sí | 8% | **31 días** | Aprobación | B | ✅ P1 |
| **Viator** (Tripadvisor) | Tours y actividades | Global | Sí | Directo | **Sí: API para partners** + widget builder | Sí | 8% (más en niveles altos) | 30 días | Aprobación; pago mínimo US$50 por transferencia | B | ✅ P1 |
| **Klook** | Actividades / eSIM | Global | Sí | Directo / Travelpayouts | Por confirmar | Sí | 2%–20% por producto (tours ~6.5%, atracciones ~5%) | 30 días (7 en hoteles/autos) | Aprobación | B | 🟡 Viable |
| **DiscoverCars** | Renta de autos | Global | Sí | Directo | Por confirmar | Sí | **70% de su margen** + 30% del seguro (es un % del margen, **no** del precio de la renta) | **365 días** | Aprobación; pago mínimo US$200 | B | ✅ P1 (autos) |
| **Rentalcars** (Booking Holdings) | Renta de autos | Global | Sí | CJ | Sí (vía CJ) | Sí | ~6% | Por confirmar | Aprobación | B | 🟡 Viable |
| **Hertz México** | Renta de autos | MX | Sí (programa "MX Global") | FlexOffers | Por confirmar | Sí | 6% | 30 días | Aprobación | B | 🟡 Viable |
| **Europcar** | Renta de autos | Global | Sí | Awin (perfil) | Por confirmar | Sí | 7% | 30 días | Aprobación | B | 🔍 Verificar MX |
| **Airalo** | eSIM de viaje | Global | Sí | Impact | Vía Impact | Sí | Desde 10% | Por confirmar | Aprobación | A (FAQ oficial) | 🟡 Viable |

### 2.5 Software, servicios digitales, suscripciones y educación

| Empresa | Categoría | País | Programa | Red | API/Feed | Deep Link | Comisión (reportada) | Cookie | Requisitos | Conf. | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Hostinger** | Hosting / dominios | Global (sitio MX) | Sí | Directo | – | Sí | Hasta 60% | Por confirmar | Aprobación | B | 🟡 Viable |
| **NordVPN** | VPN | Global | Sí | Directo / redes | – | Sí | 40% (hasta 100% en el plan de 1 mes); 30% en renovaciones | 30–60 días | Aprobación | B | 🟡 Viable |
| **Surfshark** | VPN | Global | Sí | Impact / otras | – | Sí | 40% + renovaciones | 30 días | Aprobación | B | 🟡 Viable |
| **Google Workspace** | Productividad | MX (página es-419_mx) | Sí: programa de afiliados oficial | Directo | – | Sí | No publicada aquí | – | Aprobación | A | 🟡 Viable |
| **Canva** | Diseño | Global | Ahora es el **Canvassador Program**; las inscripciones abren solo de forma periódica | Impact | – | Sí | Variable | – | Aplicación limitada | B | 🔍 |
| **Udemy** | Cursos | Global | Sí | Impact | Vía Impact | Sí | 15%–45% (reportado) | **7 días** | Aprobación | B | 🟡 Viable |
| **Coursera** | Cursos / certificados | Global | Sí | Por confirmar | – | Sí | 15%–45% (reportado) | 30 días | Aprobación | B | 🟡 Viable |
| **Platzi** | Educación tech LATAM | LATAM | Sí (reportado) | Por confirmar | – | Sí | ~10%–15% | 30 días | Aprobación | C | 🔍 Verificar |
| **Domestika** | Cursos creativos | Global | Sí (gestionado por Acceleration Partners) | Por confirmar | – | Sí | 10%–40% (datos contradictorios) | 30 días | Aprobación | B | 🔍 Verificar |
| **Hotmart** | Infoproductos | LATAM | Sí | Hotmart | Sí | Sí | Hasta 80% (lo fija el productor) | Lo fija el productor | Registro abierto | A | ✋ Revisión producto por producto |
| Spotify, Netflix, Disney+, Max, YouTube Premium | Streaming | MX | **No se encontró programa MX** | – | – | – | – | – | – | – | ⛔ |
| Rappi, Uber Eats, DiDi Food | Delivery / restaurantes | MX | **No se encontró programa de afiliados** (solo referidos de usuario) | – | – | – | – | – | – | – | ⛔ / ✋ |

### 2.6 Finanzas y seguros (solo si existe un programa legítimo)

| Empresa | Categoría | País | Programa | Red | Evidencia | Conf. | Estado |
|---|---|---|---|---|---|---|---|
| **Nu México** | Tarjeta / cuenta | MX | Mencionado como "top programa MX" en un artículo de terceros; **no se encontró la página oficial** | – | Débil | C | 🔍 Verificar |
| **American Express MX** | Tarjetas | MX | Programa "Amex B2C" listado en directorio, gestionado por Antevenio (agencia) | Antevenio / Soicos (Amex figura como cliente de Soicos) | Directorio | B/C | 🔍 Verificar |
| **BBVA** | Banca | LATAM | BBVA figura como cliente de Soicos (no se sabe si en MX) | Soicos | Directorio | C | 🔍 Verificar |
| Klar, Stori, Mercado Pago, Hey Banco | Fintech | MX | Solo programas de **referidos de usuario**, no de afiliados | – | – | – | ⛔ (los referidos no son un canal comercial; revisar sus términos) |
| Rastreator.mx, Ahorraseguros.mx | Comparadores de seguros | MX | **No se encontró programa público** | – | – | – | ✋ Acuerdo B2B (CPL) más adelante |

**Reglas especiales para finanzas y seguros (riesgo regulatorio):**

- La publicidad de crédito en México tiene obligaciones de información (por ejemplo, mostrar el **CAT** "para fines informativos y de comparación"). Cada ficha financiera debe usar **solo** el texto y los datos aprobados por la institución. **Validar con un asesor legal** antes de publicar esta categoría.
- No hacer recomendaciones personalizadas ni "precalificaciones".
- Categoría **desactivada por defecto** hasta tener al menos un programa confirmado y revisado.

### 2.7 Cashback

- **Admitad** acepta tipos de espacio de "cashback y loyalty", pero **cada anunciante decide** si lo permite.
- La mayoría de los programas (por ejemplo, Xcaret) publican qué tipos de tráfico permiten. **El cashback solo se activa por comerciante y con permiso explícito**; en la base de datos se guarda como `allows_cashback`.
- **No hay integración de cashback en el MVP** (requiere manejar saldos de usuarios, KYC y pagos: fuera de alcance).

### 2.8 Publicidad (independiente de la afiliación)

- **Google AdSense** y redes premium similares: viables cuando haya tráfico. Cuidado: Google penaliza el contenido "thin" de afiliación y aplica la política de *site reputation abuse* (desde may‑2024) a páginas de cupones de terceros sin supervisión. **Las ofertas curadas por el propio sitio no se ven afectadas**, según los blogs de Impact y Rakuten.
- Sponsored deals / tiendas destacadas: solo con contrato directo (Fase 4).

---

## 3. Restricciones y reglas que afectan el diseño del producto

| Fuente | Regla | Impacto en OFERTALIA |
|---|---|---|
| Amazon | Precios/datos solo vía Creators API; acceso a la API **solo con ≥10 ventas calificadas en 30 días** | **Problema de arranque:** hasta tener API, las fichas de Amazon se publican **sin precio** ("Ver precio en Amazon"), con enlaces creados a mano (SiteStripe). No copiar precios a mano. |
| Amazon | Enlaces prohibidos en email/PDF/offline | El newsletter **no** puede llevar enlaces de Amazon directos (verificar alternativa permitida). |
| Mercado Libre | No se permite enlazar a la página principal, "Ofertas del día" ni categorías; solo productos y listas permitidas | El link builder bloquea esas URLs (regla por comerciante). |
| Mercado Libre | No ser vendedor en ML | Es un requisito de la cuenta del titular. |
| Mercado Libre | API de búsqueda restringida | **Sin automatización de catálogo**: curaduría manual y enlaces desde su herramienta. |
| Xcaret | Sin SEM de marca ni siteunder | Bandera `allows_brand_bidding=false`; las campañas pagadas deben excluir la marca. |
| Booking.com | Pago solo por estancia completada | Las conversiones se marcan como `pending` hasta que la red las confirme; dashboard con ingresos "confirmados" y "pendientes". |
| Lenovo MX | Cookie de 3 días | Score de comisión ajustado por ventana de atribución. |
| Travelpayouts | Datos de precios en caché (no son tiempo real) | Mostrar "precio encontrado el {fecha}" y nunca garantizar el precio. |
| PROFECO (LFPC) | La publicidad debe ser veraz, comprobable y no inducir a error; multas altas por descuentos simulados. Guía PROFECO para influencers: etiquetar publicidad de forma visible | Descuento mostrado solo si hay **evidencia** (precio anterior de la fuente o historial propio). Aviso de afiliación visible en cada página con enlaces. "Patrocinado" visible en sponsored. |
| LFPDPPP (nueva ley, publicada el 20‑mar‑2025; el INAI se extinguió y sus funciones pasaron a la Secretaría Anticorrupción y Buen Gobierno) | Aviso de privacidad, consentimiento libre, específico e informado; definición amplia de "dato personal" | Tracking sin datos personales: IP truncada/hasheada con sal rotativa, sin fingerprinting; aviso de privacidad y de cookies. |

---

## 4. Ranking de oportunidades

Criterios ponderados: disponibilidad en MX, confianza de la marca, comisión esperada por clic (comisión × ticket × probabilidad de conversión), automatización, frecuencia de ofertas y facilidad de aprobación.

### 4.1 Integrar primero (P1)

| # | Fuente | Por qué | Automatización |
|---|---|---|---|
| 1 | **Mercado Libre Afiliados** | Comisiones altas para un marketplace (12–22%), marca #1 de e-commerce en MX y alta conversión | Baja (manual o semimanual) |
| 2 | **Amazon México** | Confianza máxima y gran catálogo; comisión baja en tecnología, pero muy alta conversión | Alta **después** de 10 ventas/30 días (Creators API) |
| 3 | **Awin** (Booking, Xcaret, Nike, etc.) | Red con foco explícito en MX desde 2025–2026; Booking.com entra por Awin | Alta (API + feeds) |
| 4 | **Admitad** (Coppel, PriceTravel, ~230 anunciantes MX) | El mayor catálogo de anunciantes MX en una sola API | Alta |
| 5 | **Impact** (Adidas, Airalo, Skyscanner, Udemy, Surfshark) | Líder por cuota en MX; marcas globales | Alta |
| 6 | **Travelpayouts** (Aviasales, Kiwi, Klook, GYG) | **La única fuente encontrada con API de precios de vuelos** accesible sin volumen previo | Alta |
| 7 | **Expedia Travel Creator Program** | Hoteles.com y Vrbo; cubre el hueco que dejó Airbnb | Media (feeds) |
| 8 | **GetYourGuide + Viator** | 8% y cookie de 30–31 días; experiencias para destinos de MX (Cancún, CDMX, Oaxaca) | Media/alta (Viator tiene API) |
| 9 | **DiscoverCars** | Cookie de 365 días; la renta de autos es complemento natural de vuelos y hoteles | Baja (enlaces) |
| 10 | **Samsung México** | Programa oficial, en crecimiento y premiado en 2026 | Media |
| 11 | **Grupo Xcaret** | Marca turística mexicana con comisión clara (6%) | Baja/media |

### 4.2 Mayor potencial de comisión por venta (estimado, verificar)

1. **Viajes de ticket alto**: paquetes y hoteles (Booking 4%, Expedia ~4%, Agoda 4–7%, Xcaret 6%). Una reserva de $15,000 MXN al 4% = $600 MXN.
2. **Mercado Libre**: 12–22% sobre productos de ticket medio.
3. **Software/VPN/hosting**: 40–60% (Hostinger, NordVPN, Surfshark), aunque con menos demanda en un sitio de ofertas.
4. **Experiencias**: 8% (GYG, Viator).
5. **Tecnología en retail**: 2–5% (Samsung, Coppel, Elektra, Home Depot), compensado con ticket alto.

### 4.3 Clasificación por requisitos

| Requisito | Fuentes |
|---|---|
| **Aprobación previa** (casi todas) | Amazon (definitiva tras ventas), ML, Awin y cada anunciante, Admitad por programa, Impact por marca, Skyscanner (moderada), Agoda, Expedia, GYG, Viator, DiscoverCars, Samsung, Xcaret |
| **KYC / datos fiscales / bancarios** | Amazon (entrevista fiscal), ML (Mercado Pago verificado), redes de EE. UU./UE (Impact, CJ, FlexOffers: formulario fiscal tipo W‑8BEN, pagos en USD), Awin/Admitad (datos de pago y empresa), Hotmart |
| **Contrato o acuerdo comercial directo** | Volaris/Viva, Walmart MX (si ya no está en red), Sam's Club MX, Liverpool, comparadores de seguros, sponsored deals y tiendas destacadas, Booking API (por volumen) |
| **Volumen mínimo para API** | Amazon Creators API (10 ventas/30 días), Booking API (por volumen) |
| **Registro abierto** | Travelpayouts, Hotmart, AliExpress Portals |

> **OFERTALIA nunca se registra sola en ningún programa.** El sistema solo prepara la información y la lista de pasos; el titular acepta los términos, completa el KYC y firma.

---

## 5. Pendientes de verificación (acción del titular)

1. Abrir cuentas y, **ya dentro del panel**, copiar la tabla oficial de comisiones de: Amazon MX, Mercado Libre, Awin, Admitad e Impact (actualizar este documento con confianza A).
2. Confirmar en Awin y Admitad qué marcas MX hay hoy: Liverpool, Walmart, Sephora, Palacio de Hierro, Cyberpuerta, Nike, Shein.
3. Confirmar si Nu México, Amex MX o BBVA MX tienen programas CPL/CPA abiertos a publishers (y sus reglas de publicidad).
4. Pedir la documentación de API de Despegar Partner Hub, Expedia Creator y Viator.
5. Revisar los términos de Temu y Shein para MX (qué tráfico permiten y si aceptan sitios de ofertas).
6. Consultar con un asesor legal mexicano: aviso de privacidad (LFPDPPP 2025), aviso de afiliación (PROFECO) y publicidad financiera (CAT).

---

## 6. Fuentes consultadas

**Marketplaces y retail**
- [Amazon Creators API — Locale MX](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/locale-reference/mexico)
- [Amazon PA-API 5 — aviso de deprecación](https://webservices.amazon.com/paapi5/documentation/)
- [Creators API: requisitos (10 ventas/30 días)](https://velantio.com/blog/how-to-get-amazon-creators-api-access)
- [PA-API v5 se retira abr/may 2026 (DEV)](https://dev.to/th3nate/amazon-pa-api-v5-is-shutting-down-april-30-2026-here-is-what-changes-at-the-auth-layer-22ek)
- [Amazon Afiliados MX: comisiones y pago mínimo (Otto)](https://joinotto.com/es-mx/influencer-programs/amazon-affiliate-program)
- [Mercado Libre anuncia Programa de Afiliados en MX (Marketing4eCommerce)](https://marketing4ecommerce.mx/mercado-libre-anuncia-su-programa-de-afiliados-para-el-mercado-mexicano/)
- [Mercado Libre renueva su programa (Marketing4eCommerce)](https://marketing4ecommerce.mx/mercado-libre-renueva-su-programa-de-afiliados-para-maximizar-comisiones-en-mexico/)
- [Mercado Libre: hasta 22% (Centro Urbano)](https://centrourbano.com/revista/actualidad/mercado-libre-ganar-dinero/)
- [Programa de Afiliados y Creadores ML (Alto Nivel)](https://www.altonivel.com.mx/monetiza-tus-redes-sociales-asi-funciona-el-programa-de-afiliados-y-creadores-de-mercado-libre/)
- [ML afiliados: enlaces permitidos y no permitidos (Hostinger)](https://www.hostinger.com/mx/tutoriales/?p=45612)
- [Página oficial ML afiliados](https://www.mercadolibre.com.mx/l/afiliados)
- [AliExpress Portals (UpPromote)](https://uppromote.com/affiliate-directory/aliexpress/)
- [Temu afiliados MX (El Contribuyente)](https://www.elcontribuyente.mx/2024/03/actualizaciones-del-programa-de-afiliados-de-temu-hasta-mx500000-al-mes/)
- [Shein affiliate (FlexOffers)](https://www.flexoffers.com/affiliate-programs/shein-affiliate-program/)
- [Walmart Mexico (FlexOffers)](https://www.flexoffers.com/affiliate-programs/walmart-mexico-affiliate-program)
- [Coppel MX (FlexOffers)](https://www.flexoffers.com/affiliate-programs/coppel-mx-affiliate-program/) · [Coppel en Admitad (affi.io)](https://affi.io/m/coppel)
- [Palacio de Hierro (FlexOffers)](https://www.flexoffers.com/affiliate-programs/palacio-de-hierro-mx-affiliate-program/)
- [Elektra (affi.io)](https://affi.io/m/elektra)
- [Home Depot MX (FlexOffers)](https://www.flexoffers.com/affiliate-programs/the-home-depot-mx-affiliate-program/)
- [Sam's Club (UpPromote)](https://uppromote.com/affiliate-program-directory/sams-club)

**Tecnología, moda y belleza**
- [Samsung MX: eCommerce y programa de afiliados (Samsung Newsroom)](https://news.samsung.com/mx/samsung-transforma-su-ecommerce-y-es-reconocido-entre-las-mejores-estrategias-digitales-de-mexico)
- [Samsung MX (FlexOffers)](https://www.flexoffers.com/affiliate-programs/samsung-mx-affiliate-program/)
- [Lenovo Mexico (FlexOffers)](https://www.flexoffers.com/affiliate-programs/lenovo-mexico-affiliate-program/)
- [Cyberpuerta (affi.io)](https://affi.io/m/cyberpuerta-mx)
- [Apple Performance Partners](https://performance-partners.apple.com/faq)
- [Nike MX (FlexOffers)](https://www.flexoffers.com/affiliate-programs/nike-mx-affiliate-program/) · [Nike en Awin](https://ui.awin.com/merchant-profile/117547)
- [Adidas Mexico (FlexOffers)](https://www.flexoffers.com/affiliate-programs/adidas-mexico-affiliate-program) · [Adidas en Impact (UpPromote)](https://uppromote.com/affiliate-directory/adidas/)
- [Sephora MX (Affilitizer)](https://www.affilitizer.com/programs/sephora.com.mx)
- [Green Man Gaming (FlexOffers)](https://www.flexoffers.com/affiliate-programs/green-man-gaming-affiliate-program/) · [Eneba (Daisycon)](https://www.daisycon.com/en/campaigns/14162-eneba/)

**Viajes**
- [Booking.com: migración de afiliados a redes (Net Influencer)](https://www.netinfluencer.com/booking-com-moves-all-affiliates-to-awin-what-to-know-about-termination-notices)
- [Booking.com teardown 2026 (Track360)](https://track360.io/blog/booking-com-affiliate-partner-program-operator-teardown-2026)
- [Booking.com en Awin](https://www.awin.com/au/advertisers/partner/booking.com)
- [Expedia Group affiliate program](https://partner.expediagroup.com/en-us/solutions/explore-our-affiliate-program) · [Expedia Creator](https://creator.expediagroup.com/)
- [Despegar Partner Hub (theatdb)](https://www.theatdb.com/companies/despegar-partner-hub-2)
- [PriceTravel (affi.io)](https://affi.io/m/pricetravel)
- [Travelpayouts: marcas con API/feeds](https://support.travelpayouts.com/hc/en-us/articles/20384016664594-Brands-that-provide-access-to-APIs-and-data-feeds-for-Travelpayouts-partners)
- [Travelpayouts: programas de vuelos](https://www.travelpayouts.com/blog/best-flights-affiliate-programs/amp/)
- [Trip.com (Travelpayouts)](https://travelpayouts.com/en/offers/trip-com-affiliate-program)
- [Agoda teardown 2026 (Track360)](https://track360.io/blog/agoda-affiliate-program-operator-teardown-2026)
- [Skyscanner (Travelpayouts blog)](https://www.travelpayouts.com/blog/skyscanner-flight-affiliate-program/amp/)
- [Kayak (FlexOffers)](https://www.flexoffers.com/affiliate-programs/kayak-affiliate-program)
- [Aeroméxico MX (FlexOffers)](https://www.flexoffers.com/affiliate-programs/aeromexico-mx-affiliate-program)
- [Xcaret: programa de afiliados oficial](https://xcaret.com/en/affiliates/) · [Xcaret en Awin](https://ui.awin.com/merchant-profile-terms/34947) · [affi.io](https://affi.io/m/xcaret)
- [Barceló MX (FlexOffers)](https://www.flexoffers.com/affiliate-programs/barcelo-hotels-resorts-mx-affiliate-program)
- [Airbnb sin programa de afiliados (Track360)](https://track360.io/blog/airbnb-vacation-rental-affiliate-referral-programs-operator-teardown-2026) · [PhocusWire](https://www.phocuswire.com/Airbnb-axes-third-party-affiliate-programme)
- [GetYourGuide (Travelpayouts)](https://www.travelpayouts.com/blog/earn-with-getyourguide/amp/)
- [Viator partner resources](https://partnerresources.viator.com/)
- [Klook (Travelpayouts)](https://travelpayouts.com/en/offers/klook-affiliate-program)
- [DiscoverCars (Post Affiliate Pro)](https://www.postaffiliatepro.com/affiliate-program-directory/discovercars-com-affiliate-program/) · [Car rental guide (Track360)](https://track360.io/blog/car-rental-transfer-affiliate-programs-operator-guide-2026)
- [Hertz MX (FlexOffers)](https://www.flexoffers.com/affiliate-programs/hertz-mx-global-affiliate-program/)
- [Airalo affiliate FAQ (oficial)](https://www.airalo.com/blog/airalo-affiliate-program-faqs)

**Software y educación**
- [VPN affiliate programs (UpPromote)](https://uppromote.com/affiliate-directory/nordvpn/) · [Surfshark](https://uppromote.com/affiliate-directory/surfshark/)
- [Hostinger (Post Affiliate Pro)](https://cdn.qualityunit.com/affiliate-program-directory/hostinger-affiliate-program)
- [Google Workspace afiliados MX](https://workspace.google.com/intl/es-419_mx/landing/partners/affiliate)
- [Canva affiliate 2026 (Reditus)](https://getreditus.com/affiliate-programs/canva)
- [Afiliados de cursos LATAM 2026 (Aprender21)](https://www.aprender21.com/blog/programa-de-afiliados-cursos)
- [Domestika + Acceleration Partners](https://www.accelerationpartners.com/resources/domestika-selects-acceleration-partners/)
- [Hotmart afiliados MX](https://hotmart.com/es-mx/afiliados)

**Redes, mercado y competencia**
- [Awin llega a México (Business Wire, jun‑2025)](https://www.businesswire.com/news/home/20250610300563/en/Awin-Brings-Its-Affiliate-Platform-to-Mexico-Connecting-Brands-With-New-Audiences)
- [Awin expande su presencia en México (Roastbrief, ago‑2026)](https://roastbrief.com.mx/2026/08/awin-expande-su-presencia-en-mexico-y-acelera-una-nueva-etapa-del-marketing-de-afiliados-en-america-latina/)
- [Admitad: store de México](https://www.admitad.com/store/mexico/)
- [Soicos (PerformanceIN)](https://performancein.com/news/2021/04/15/qa-soicos-on-the-affiliate-channel-in-latin-america-and-its-tremendous-growth/) · [Dealroom](https://app.dealroom.co/companies/soicos)
- [Affiliate marketing en México (wmtips)](https://www.wmtips.com/technologies/affiliate-marketing/country/mx/)
- [Affiliate marketing en México 2026 (usearticle)](https://www.usearticle.com/affiliate-marketing-in/mexico)
- [Promodescuentos: cómo verificamos cupones (redes y acuerdos)](https://www.promodescuentos.com/cupones/como-verificamos-cupones)

**Legal y SEO**
- [PROFECO: multas 2025 (KPMG)](https://kpmg.com/mx/es/tendencias/2025/01/flash-monto-de-multas-de-profeco-en-2025.html)
- [PROFECO: guía para influencers (ECIJA)](https://www.ecija.com/actualidad-insights/influencers-mexican-consumer-protection-agency-establishes-advertising-guidelines/)
- [Nueva LFPDPPP 2025 (Littler)](https://www.littler.com/es/news-analysis/asap/mexico-tiene-nueva-ley-en-materia-de-proteccion-de-datos-personales) · [Garrigues](https://www.garrigues.com/es_ES/noticia/mexico-nueva-ley-federal-proteccion-datos-personales-posesion-particulares-introduce)
- [Google site reputation abuse y afiliados (Impact)](https://impact.com/affiliate/googles-updated-site-reputation-abuse-policy-on-affiliate-marketers/) · [Rakuten](https://blog.rakutenadvertising.com/en-uk/news/google-spam-update-affiliate-marketing/)
