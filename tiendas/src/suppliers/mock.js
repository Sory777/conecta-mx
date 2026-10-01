// Proveedor de demostración: simula un mayorista chino (estilo CJ/AliExpress)
// para poder probar todo el flujo sin credenciales. Los pedidos "avanzan" solos:
// procesando -> enviado (con guía) -> entregado.

const P = (category, icon, title, description, costUsd, shippingUsd) => ({ category, icon, title, description, costUsd, shippingUsd });

const CATALOG = [
  P('gadgets', 'headphones', 'Audífonos inalámbricos TWS Bluetooth 5.3', 'Estuche de carga, cancelación de ruido ambiental y hasta 24 h de batería.', 6.8, 2.1),
  P('gadgets', 'watch', 'Reloj inteligente deportivo IP68', 'Ritmo cardiaco, oxígeno en sangre, notificaciones y más de 100 modos deportivos.', 11.5, 2.4),
  P('gadgets', 'battery', 'Power bank magnético 10 000 mAh', 'Carga inalámbrica magnética y USB-C de 20 W, ultra delgado.', 9.2, 2.6),
  P('gadgets', 'lamp', 'Tira LED RGB 5 m con control por app', 'Sincroniza con música, 16 millones de colores y temporizador.', 4.9, 2.2),
  P('gadgets', 'speaker', 'Bocina Bluetooth portátil resistente al agua', 'Sonido 360°, 12 h de reproducción y correa para colgar.', 7.4, 2.5),
  P('gadgets', 'phone', 'Soporte de celular para auto con carga rápida', 'Sujeción automática por sensor y carga inalámbrica de 15 W.', 5.6, 1.9),
  P('gadgets', 'camera', 'Mini cámara de seguridad WiFi 1080p', 'Visión nocturna, detección de movimiento y audio bidireccional.', 10.9, 2.3),
  P('gadgets', 'keyboard', 'Teclado mecánico compacto RGB 68 teclas', 'Switches intercambiables, cable USB-C desmontable.', 16.5, 3.8),
  P('gadgets', 'mouse', 'Mouse inalámbrico silencioso recargable', 'DPI ajustable, batería de larga duración y diseño ergonómico.', 3.9, 1.6),
  P('gadgets', 'cable', 'Cable USB-C 3 en 1 de carga rápida', 'Lightning, USB-C y micro USB en un solo cable trenzado de nylon.', 1.8, 1.2),
  P('gadgets', 'gamepad', 'Control inalámbrico para celular y PC', 'Compatible con Android, iOS y PC, con soporte para teléfono.', 8.7, 2.4),
  P('gadgets', 'projector', 'Mini proyector portátil HD', 'Proyecta hasta 120", conexión HDMI y USB, ideal para películas.', 32.0, 6.5),

  P('ropa', 'shirt', 'Playera oversize de algodón', 'Corte holgado, 100 % algodón, varios colores.', 4.2, 1.8),
  P('ropa', 'hoodie', 'Sudadera con capucha unisex', 'Felpa suave por dentro, bolsillo canguro y puños elásticos.', 9.8, 3.2),
  P('ropa', 'dress', 'Vestido casual de verano estampado', 'Tela ligera y fresca, largo midi con cinturón.', 7.5, 2.0),
  P('ropa', 'pants', 'Pantalón cargo holgado', 'Múltiples bolsillos, cintura ajustable y tela resistente.', 9.1, 3.0),
  P('ropa', 'jacket', 'Chamarra rompevientos ligera', 'Impermeable, plegable y con capucha ajustable.', 12.4, 3.4),
  P('ropa', 'shirt', 'Camisa de lino manga larga', 'Transpirable, corte relajado, perfecta para clima cálido.', 8.3, 2.1),
  P('ropa', 'socks', 'Set de 5 pares de calcetines deportivos', 'Algodón transpirable con refuerzo en talón y punta.', 3.1, 1.4),
  P('ropa', 'pants', 'Leggings deportivos de tiro alto', 'Tela compresiva, no transparenta, con bolsillo lateral.', 5.6, 1.7),
  P('ropa', 'shirt', 'Polo de piqué slim fit', 'Clásico y versátil, algodón de alta calidad.', 6.1, 1.9),
  P('ropa', 'dress', 'Falda plisada midi', 'Cintura elástica, caída fluida, ideal para oficina o salida.', 6.9, 1.8),
  P('ropa', 'hoodie', 'Suéter tejido de cuello redondo', 'Tejido suave y cálido para temporada de frío.', 10.2, 3.0),
  P('ropa', 'jacket', 'Chaleco acolchado ultraligero', 'Relleno térmico y se guarda en su propia bolsa.', 11.0, 2.8),

  P('accesorios', 'glasses', 'Lentes de sol polarizados UV400', 'Armazón ligero y resistente con estuche incluido.', 3.4, 1.3),
  P('accesorios', 'backpack', 'Mochila antirrobo con puerto USB', 'Compartimento para laptop de 15.6" y tela repelente al agua.', 12.8, 4.2),
  P('accesorios', 'wallet', 'Cartera minimalista con bloqueo RFID', 'Aluminio y piel sintética, hasta 12 tarjetas.', 4.6, 1.4),
  P('accesorios', 'cap', 'Gorra de béisbol bordada', 'Ajustable, algodón, varios colores.', 3.2, 1.5),
  P('accesorios', 'watch', 'Reloj análogo minimalista', 'Correa de malla de acero inoxidable, resistente al agua.', 7.9, 1.8),
  P('accesorios', 'bag', 'Bolsa crossbody de piel sintética', 'Compacta, con correa ajustable y cierre metálico.', 8.4, 2.2),
  P('accesorios', 'gem', 'Set de aretes y collar de acero', 'Acero inoxidable hipoalergénico con baño de oro.', 3.8, 1.1),
  P('accesorios', 'umbrella', 'Paraguas plegable automático', 'Abre y cierra con un botón, resistente al viento.', 5.9, 2.4),
  P('accesorios', 'belt', 'Cinturón de piel con hebilla automática', 'Ajuste sin orificios, elegante y duradero.', 4.9, 1.6),
  P('accesorios', 'phone', 'Funda transparente antigolpes con MagSafe', 'Esquinas reforzadas y compatible con carga magnética.', 2.1, 1.0),
  P('accesorios', 'bag', 'Bolsa de viaje plegable', 'Gran capacidad, se acopla a la maleta.', 6.7, 2.6),
  P('accesorios', 'glasses', 'Lentes con filtro de luz azul', 'Reduce la fatiga visual frente a pantallas.', 2.9, 1.2),
];

const orders = new Map();

export const mockSupplier = {
  name: 'mock',
  label: 'Proveedor demo (simulado)',

  async fetchCatalog() {
    return CATALOG.map((p, i) => ({
      supplierProductId: `MOCK-P${1000 + i}`,
      supplierVariantId: `MOCK-V${1000 + i}`,
      title: p.title,
      description: p.description,
      category: p.category,
      imageUrl: null,
      icon: p.icon,
      costUsd: p.costUsd,
      shippingUsd: p.shippingUsd,
    }));
  },

  async createOrder(order) {
    if (!order.items.length) throw new Error('Pedido sin artículos');
    const id = `MOCK-SO-${order.number}`;
    orders.set(id, { createdAt: Date.now() });
    return { supplierOrderId: id };
  },

  async getOrderStatus(supplierOrderId) {
    const o = orders.get(supplierOrderId);
    // Tras un reinicio no hay memoria: tratamos el pedido como ya enviado.
    const age = o ? Date.now() - o.createdAt : Infinity;
    if (age < 60_000) return { status: 'processing' };
    const trackingNumber = 'LP' + supplierOrderId.replace(/\D/g, '').padStart(9, '0') + 'CN';
    if (age < 5 * 60_000) return { status: 'shipped', trackingNumber };
    return { status: 'delivered', trackingNumber };
  },
};
