/**
 * Títols i tarifes del bus urbà de Sabadell (TUS) i títols integrats (ATM / T-mobilitat).
 *
 * Font inicial: dades facilitades pel responsable del projecte (2026-10-11) a partir de tus.es, ATM i T-mobilitat.
 * Verificació: des de l'entorn de desenvolupament no es van poder obrir les pàgines oficials (xarxa bloquejada);
 * una cerca web el 2026-10-11 hi coincideix (preus i vigència des de l'1 de maig de 2026), però no s'ha llegit la
 * pàgina original → `verified: false`. A la interfície es mostren com a «publicades per TUS» amb la recomanació de
 * confirmar-ho, mai com a verificades avui. Vegeu docs/TARIFES_PUNTS_DE_VENDA.md.
 */
type L = { ca: string; es: string };

export type FareCategory = 'single' | 'multi' | 'pass' | 'social' | 'integrated';
export type FareGroup = 'tus' | 'atm';
/** ordinari, bonificat, gratuït amb requisits, cost d'emissió d'una targeta, o sense preu publicat aquí */
export type PriceKind = 'ordinary' | 'reduced' | 'free' | 'issuance' | 'none';

export interface Fare {
  id: string;
  group: FareGroup;
  category: FareCategory;
  name: L;
  /** euros (null si no n'hi ha); per a `issuance` és el cost de la targeta, no d'un viatge */
  price: number | null;
  priceKind: PriceKind;
  /** una línia: per a qui és i què té de bo */
  summary: L;
  /** etiquetes curtes (no només color): Bonificat, Jove, Social, Només L12… */
  tags: L[];
  /** condicions principals (es veuen a la targeta, màxim 3) */
  highlights: L[];
  /** condicions completes, requisits i notes (a «Més informació») */
  details: L[];
  eligibility?: L;
  scope: L;
  transfers?: L;
  /** on es compra o es tramita, en text (el directori només llista el que confirmen les dades) */
  where?: L;
  /** id del títol al directori de punts de venda */
  salesKey?: SalesTitle;
  officialUrl: string;
  validFrom?: string;
  verified: boolean;
}

export type SalesTitle = 't-sabadell' | 't10' | 't-mensual' | 't-mensual-jove';

export const FARES_VALID_FROM = '2026-05-01';
export const FARES_CHECKED = '2026-10-11';

export const LINKS = {
  tus: { ca: 'https://www.tus.es/index.php/ca/informacio-d-interes/anar-en-bus/tarifes', es: 'https://www.tus.es/index.php/es/informacion-de-interes/tarifas' } as L,
  tusSales: { ca: 'https://www.tus.es/index.php/ca/informacio-d-interes/punts-de-venda', es: 'https://www.tus.es/index.php/es/informacion-de-interes/puntos-de-venta' } as L,
  atm: 'https://www.atm.cat/sistema-tarifari-integrat/titols-i-tarifes/titols-i-preus',
  tmobFares: 'https://t-mobilitat.atm.cat/web/t-mobilitat/new-fares',
  t16: 'https://t-mobilitat.atm.cat/web/t-mobilitat/t-16',
  school: 'https://www.sabadell.cat/ca/bitllet-escolar',
};

const RDL: L = {
  ca: 'Preu bonificat (reducció del 50 %) en el marc del RDL 17/2025, de 23 de desembre, amb finançament del Ministeri de Transports i Mobilitat Sostenible i de l’Ajuntament de Sabadell.',
  es: 'Precio bonificado (reducción del 50 %) en el marco del RDL 17/2025, de 23 de diciembre, con financiación del Ministerio de Transportes y Movilidad Sostenible y del Ayuntamiento de Sabadell.',
};
const DNI: L[] = [
  { ca: 'Cal escriure-hi el DNI o el número d’identificació de la persona titular.', es: 'Debe incluir el DNI o el número de identificación del titular.' },
  { ca: 'S’ha de dur amb un document oficial d’identitat vigent.', es: 'Debe acompañarse de un documento oficial identificativo en vigor.' },
];
const OAC_SBD: L = { ca: 'Es tramita a l’Oficina d’Atenció Ciutadana de l’Ajuntament de Sabadell.', es: 'Se gestiona en la Oficina de Atención Ciudadana del Ayuntamiento de Sabadell.' };
const URBAN: L = { ca: 'Bus urbà de Sabadell (TUS)', es: 'Autobús urbano de Sabadell (TUS)' };

export const FARES: Fare[] = [
  {
    id: 'senzill',
    group: 'tus',
    category: 'single',
    name: { ca: 'Bitllet senzill', es: 'Billete sencillo' },
    price: 1.8,
    priceKind: 'ordinary',
    summary: { ca: 'Per a un viatge de tant en tant. El compres al bus.', es: 'Para un viaje de vez en cuando. Se compra en el bus.' },
    tags: [],
    highlights: [
      { ca: '1 viatge', es: '1 viaje' },
      { ca: 'Sense transbord', es: 'Sin transbordo' },
      { ca: 'Al conductor o conductora', es: 'Al conductor o conductora' },
    ],
    details: [
      { ca: 'L’expedeix el conductor o la conductora.', es: 'Lo expide el conductor o la conductora.' },
      { ca: 'Vàlid per a un sol viatge. Títol unipersonal.', es: 'Válido para un único viaje. Título unipersonal.' },
      { ca: 'No permet fer transbord.', es: 'No permite transbordos.' },
      { ca: 'Els infants de menys de 4 anys viatgen gratis.', es: 'Los menores de 4 años viajan gratis.' },
    ],
    scope: URBAN,
    transfers: { ca: 'No', es: 'No' },
    where: { ca: 'Al mateix autobús.', es: 'En el propio autobús.' },
    officialUrl: LINKS.tus.ca,
    validFrom: FARES_VALID_FROM,
    verified: false,
  },
  {
    id: 't10',
    group: 'tus',
    category: 'multi',
    name: { ca: 'Targeta T-10', es: 'Tarjeta T-10' },
    price: 10.1,
    priceKind: 'ordinary',
    summary: { ca: '10 viatges que pot fer servir més d’una persona, amb transbord.', es: '10 viajes que puede usar más de una persona, con transbordo.' },
    tags: [{ ca: 'Multipersonal', es: 'Multipersonal' }],
    highlights: [
      { ca: '10 viatges', es: '10 viajes' },
      { ca: 'Transbord 1 h 15 min', es: 'Transbordo 1 h 15 min' },
      { ca: 'Compartible', es: 'Compartible' },
    ],
    details: [
      { ca: 'Títol multipersonal: la pot fer servir més d’una persona.', es: 'Título multipersonal: puede usarla más de una persona.' },
      { ca: 'Permet fer 10 viatges.', es: 'Permite realizar 10 viajes.' },
      { ca: 'Permet fer transbord entre línies urbanes diferents durant 1 hora i 15 minuts.', es: 'Permite transbordar entre diferentes líneas urbanas durante 1 hora y 15 minutos.' },
      { ca: 'Es ven a l’Oficina de Mobilitat de TUS i als establiments adherits a la xarxa PunTUS.', es: 'Se vende en la Oficina de Mobilitat de TUS y en los establecimientos adheridos a la red PunTUS.' },
    ],
    scope: URBAN,
    transfers: { ca: 'Entre línies urbanes, durant 1 h 15 min', es: 'Entre líneas urbanas, durante 1 h 15 min' },
    where: { ca: 'Oficina de Mobilitat de TUS i xarxa PunTUS.', es: 'Oficina de Mobilitat de TUS y red PunTUS.' },
    salesKey: 't10',
    officialUrl: LINKS.tus.ca,
    validFrom: FARES_VALID_FROM,
    verified: false,
  },
  {
    id: 't-mensual',
    group: 'tus',
    category: 'pass',
    name: { ca: 'T-mensual bonificada', es: 'T-mensual bonificada' },
    price: 20.6,
    priceKind: 'reduced',
    summary: { ca: 'Viatges il·limitats durant 30 dies. Per a qui agafa el bus cada dia.', es: 'Viajes ilimitados durante 30 días. Para quien coge el bus cada día.' },
    tags: [{ ca: 'Bonificat', es: 'Bonificado' }],
    highlights: [
      { ca: 'Il·limitat 30 dies', es: 'Ilimitado 30 días' },
      { ca: 'Personal', es: 'Personal' },
      { ca: '−50 %', es: '−50 %' },
    ],
    details: [
      { ca: 'Títol personal i intransferible.', es: 'Título personal e intransferible.' },
      { ca: 'Viatges il·limitats durant 30 dies seguits des de la primera validació.', es: 'Viajes ilimitados durante 30 días consecutivos desde la primera validación.' },
      ...DNI,
      RDL,
    ],
    eligibility: { ca: 'Qualsevol persona, amb identificació.', es: 'Cualquier persona, con identificación.' },
    scope: URBAN,
    salesKey: 't-mensual',
    officialUrl: LINKS.tus.ca,
    validFrom: FARES_VALID_FROM,
    verified: false,
  },
  {
    id: 't-mensual-jove',
    group: 'tus',
    category: 'pass',
    name: { ca: 'T-mensual Jove bonificada', es: 'T-mensual Jove bonificada' },
    price: 14.35,
    priceKind: 'reduced',
    summary: { ca: 'El mateix que la T-mensual, més barata si tens menys de 30 anys.', es: 'Lo mismo que la T-mensual, más barata si tienes menos de 30 años.' },
    tags: [
      { ca: 'Jove · −30 anys', es: 'Joven · −30 años' },
      { ca: 'Bonificat', es: 'Bonificado' },
    ],
    highlights: [
      { ca: 'Il·limitat 30 dies', es: 'Ilimitado 30 días' },
      { ca: 'Menys de 30 anys', es: 'Menores de 30 años' },
      { ca: '−50 %', es: '−50 %' },
    ],
    details: [
      { ca: 'Títol personal i intransferible per a joves de menys de 30 anys.', es: 'Título personal e intransferible para jóvenes menores de 30 años.' },
      { ca: 'Viatges il·limitats durant 30 dies seguits des de la primera validació.', es: 'Viajes ilimitados durante 30 días consecutivos desde la primera validación.' },
      ...DNI,
      RDL,
    ],
    eligibility: { ca: 'Menys de 30 anys.', es: 'Menores de 30 años.' },
    scope: URBAN,
    salesKey: 't-mensual-jove',
    officialUrl: LINKS.tus.ca,
    validFrom: FARES_VALID_FROM,
    verified: false,
  },
  {
    id: 'tarificacio-social',
    group: 'tus',
    category: 'social',
    name: { ca: 'Carnet de tarificació social', es: 'Carnet de tarificación social' },
    price: 0,
    priceKind: 'free',
    summary: { ca: 'Viatges gratuïts i il·limitats per a les persones beneficiàries.', es: 'Viajes gratuitos e ilimitados para las personas beneficiarias.' },
    tags: [{ ca: 'Social', es: 'Social' }],
    highlights: [
      { ca: 'Gratuït', es: 'Gratuito' },
      { ca: 'Il·limitat', es: 'Ilimitado' },
      { ca: 'Cal tenir-hi dret', es: 'Requiere tener derecho' },
    ],
    details: [
      { ca: 'Personal i intransferible.', es: 'Personal e intransferible.' },
      { ca: 'Permet viatges il·limitats i gratuïts al transport urbà de Sabadell.', es: 'Permite viajes ilimitados y gratuitos en el transporte urbano de Sabadell.' },
      { ca: 'L’expedeix l’Ajuntament de Sabadell a les persones beneficiàries de la tarificació social.', es: 'Lo expide el Ayuntamiento de Sabadell a las personas beneficiarias de la tarificación social.' },
      OAC_SBD,
    ],
    eligibility: { ca: 'Persones beneficiàries de la tarificació social.', es: 'Personas beneficiarias de la tarificación social.' },
    scope: URBAN,
    where: OAC_SBD,
    officialUrl: LINKS.tus.ca,
    verified: false,
  },
  {
    id: 'acompanyant',
    group: 'tus',
    category: 'social',
    name: { ca: 'Carnet d’acompanyant', es: 'Carnet de acompañante' },
    price: 0,
    priceKind: 'free',
    summary: { ca: 'L’acompanyant d’una persona que necessita suport viatja gratis.', es: 'El acompañante de una persona que necesita apoyo viaja gratis.' },
    tags: [{ ca: 'Social', es: 'Social' }],
    highlights: [
      { ca: 'Gratuït', es: 'Gratuito' },
      { ca: 'Només amb la persona titular', es: 'Solo con la persona titular' },
    ],
    details: [
      { ca: 'Personal i intransferible.', es: 'Personal e intransferible.' },
      { ca: 'L’expedeix l’Ajuntament de Sabadell a les persones que tenen acreditada la necessitat de suport en els desplaçaments en transport col·lectiu.', es: 'Lo expide el Ayuntamiento de Sabadell a las personas que tienen acreditada la necesidad de apoyo en sus desplazamientos en transporte colectivo.' },
      { ca: 'Permet viatjar gratis al transport urbà de Sabadell.', es: 'Permite viajar gratis en el transporte urbano de Sabadell.' },
      { ca: 'Només és vàlid quan l’acompanyant viatja amb la persona titular que té acreditada la necessitat de suport.', es: 'Solo es válido cuando el acompañante viaja con la persona titular que tiene acreditada la necesidad de apoyo.' },
      OAC_SBD,
    ],
    eligibility: { ca: 'Necessitat de suport acreditada.', es: 'Necesidad de apoyo acreditada.' },
    scope: URBAN,
    where: OAC_SBD,
    officialUrl: LINKS.tus.ca,
    verified: false,
  },
  {
    id: 'escolar',
    group: 'tus',
    category: 'social',
    name: { ca: 'Bitllet col·lectiu escolar', es: 'Billete colectivo escolar' },
    price: null,
    priceKind: 'none',
    summary: { ca: 'Bitllets amb descompte per a grups escolars del programa Ciutat i Escola.', es: 'Billetes con descuento para grupos escolares del programa Ciutat i Escola.' },
    tags: [{ ca: 'Escoles', es: 'Escuelas' }],
    highlights: [
      { ca: 'Amb descompte', es: 'Con descuento' },
      { ca: 'Cal demanar-lo abans', es: 'Hay que pedirlo antes' },
    ],
    details: [
      { ca: 'Per a centres educatius que es desplacen en grup a activitats del programa Ciutat i Escola.', es: 'Para centros educativos que se desplazan en grupo a actividades del programa Ciutat i Escola.' },
      { ca: 'Es poden comprar bitllets col·lectius amb descompte.', es: 'Se pueden adquirir billetes colectivos con descuento.' },
      { ca: 'Cal fer la comanda abans amb el formulari oficial de l’Ajuntament.', es: 'Es necesario realizar el pedido previamente mediante el formulario oficial del Ayuntamiento.' },
    ],
    eligibility: { ca: 'Centres educatius (programa Ciutat i Escola).', es: 'Centros educativos (programa Ciutat i Escola).' },
    scope: URBAN,
    where: { ca: 'Formulari de l’Ajuntament de Sabadell.', es: 'Formulario del Ayuntamiento de Sabadell.' },
    officialUrl: LINKS.school,
    verified: false,
  },
  {
    id: 'tbus-sant-quirze',
    group: 'tus',
    category: 'social',
    name: { ca: 'TBUS gratuïta de Sant Quirze del Vallès', es: 'TBUS gratuita de Sant Quirze del Vallès' },
    price: 0,
    priceKind: 'free',
    summary: { ca: 'Només per a la línia L12 i per a veïns de Sant Quirze amb tarificació social.', es: 'Solo para la línea L12 y para vecinos de Sant Quirze con tarificación social.' },
    tags: [
      { ca: 'Només L12', es: 'Solo L12' },
      { ca: 'Sant Quirze', es: 'Sant Quirze' },
    ],
    highlights: [
      { ca: 'Gratuït', es: 'Gratuito' },
      { ca: 'Només línia L12', es: 'Solo línea L12' },
    ],
    details: [
      { ca: 'Títol personal i intransferible.', es: 'Título personal e intransferible.' },
      { ca: 'Viatges il·limitats només a la línia L12, Estació Centre – Sant Quirze Parc. No serveix per a la resta de línies de Sabadell.', es: 'Viajes ilimitados solo en la línea L12, Estació Centre – Sant Quirze Parc. No sirve para el resto de líneas de Sabadell.' },
      { ca: 'Per a la ciutadania de Sant Quirze del Vallès beneficiària del seu sistema municipal de tarificació social.', es: 'Para la ciudadanía de Sant Quirze del Vallès beneficiaria de su sistema municipal de tarificación social.' },
      { ca: 'Es tramita a l’Oficina d’Atenció Ciutadana de l’Ajuntament de Sant Quirze del Vallès.', es: 'Se gestiona en la Oficina de Atención Ciudadana del Ayuntamiento de Sant Quirze del Vallès.' },
    ],
    eligibility: { ca: 'Veïns de Sant Quirze del Vallès amb tarificació social municipal.', es: 'Vecinos de Sant Quirze del Vallès con tarificación social municipal.' },
    scope: { ca: 'Només línia L12 (Estació Centre – Sant Quirze Parc)', es: 'Solo línea L12 (Estació Centre – Sant Quirze Parc)' },
    where: { ca: 'Ajuntament de Sant Quirze del Vallès (OAC).', es: 'Ayuntamiento de Sant Quirze del Vallès (OAC).' },
    officialUrl: LINKS.tus.ca,
    verified: false,
  },
  {
    id: 't16',
    group: 'atm',
    category: 'integrated',
    name: { ca: 'T-16 (T-mobilitat)', es: 'T-16 (T-mobilitat)' },
    price: 4.5,
    priceKind: 'issuance',
    summary: { ca: 'Infants i adolescents de 4 a 16 anys viatgen gratis a la seva zona.', es: 'Niños y adolescentes de 4 a 16 años viajan gratis en su zona.' },
    tags: [{ ca: 'Infants i joves', es: 'Niños y jóvenes' }],
    highlights: [
      { ca: 'Viatges gratuïts', es: 'Viajes gratuitos' },
      { ca: 'De 4 a 16 anys', es: 'De 4 a 16 años' },
      { ca: 'Valida a cada viatge', es: 'Valida en cada viaje' },
    ],
    details: [
      { ca: 'Per a infants i adolescents des dels 4 anys fins als sis mesos després de fer-ne 16.', es: 'Para niños, niñas y adolescentes desde los 4 años hasta los seis meses posteriores a cumplir los 16.' },
      { ca: 'Viatges il·limitats i gratuïts dins de la mateixa zona tarifària de residència a la xarxa del sistema tarifari integrat.', es: 'Viajes ilimitados y gratuitos dentro de la misma zona tarifaria de residencia en la red del sistema tarifario integrado.' },
      { ca: 'Personal i intransferible. Cal validar-la a cada viatge.', es: 'Personal e intransferible. Debe validarse en cada viaje.' },
      { ca: 'Els 4,50 € són el cost d’emissió de la targeta (o d’un duplicat per pèrdua o mal estat imputable a la persona usuària), no el preu d’un viatge.', es: 'Los 4,50 € son el coste de emisión de la tarjeta (o de un duplicado por pérdida o mal estado imputable al usuario), no el precio de un viaje.' },
      { ca: 'Fins a nou avís, la T-16 ja no es tramita a l’Oficina de Mobilitat de TUS: cal adreçar-se al servei d’atenció de T-mobilitat.', es: 'Hasta nuevo aviso, la T-16 ya no se gestiona en la Oficina de Mobilitat de TUS: debe dirigirse al servicio de atención de T-mobilitat.' },
    ],
    eligibility: { ca: 'De 4 anys fins a 6 mesos després de fer-ne 16.', es: 'De 4 años hasta 6 meses después de cumplir 16.' },
    scope: { ca: 'Zona tarifària de residència (sistema tarifari integrat)', es: 'Zona tarifaria de residencia (sistema tarifario integrado)' },
    where: { ca: 'Servei d’atenció de T-mobilitat (no a l’Oficina de Mobilitat de TUS).', es: 'Servicio de atención de T-mobilitat (no en la Oficina de Mobilitat de TUS).' },
    officialUrl: LINKS.t16,
    verified: false,
  },
];

export const fareById = (id: string) => FARES.find((f) => f.id === id);

/** cost d'un mes amb n viatges: per comparar títols (només els que tenen preu per viatge o abonament) */
export function monthlyCost(n: number, young: boolean): { id: string; cost: number }[] {
  const p = (id: string) => fareById(id)!.price!;
  const out = [
    { id: 'senzill', cost: n * p('senzill') },
    { id: 't10', cost: Math.ceil(n / 10) * p('t10') },
    { id: 't-mensual', cost: p('t-mensual') },
  ];
  if (young) out.push({ id: 't-mensual-jove', cost: p('t-mensual-jove') });
  return out.map((x) => ({ ...x, cost: Math.round(x.cost * 100) / 100 })).sort((a, b) => a.cost - b.cost);
}

export const euros = (v: number, lang: 'ca' | 'es') =>
  new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v);
