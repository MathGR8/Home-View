// Catálogo de móveis com medidas comuns no Brasil (largura × profundidade × altura, em cm).
// sym = desenho na planta e modelo no 3D. layer: normal | floor (tapete) | wall (na parede).

export const CATALOG = [
  { cat: 'Sala', items: [
    { k: 'sofa3', n: 'Sofá 3 lugares', w: 210, d: 90, h: 85, sym: 'sofa', color: '#8fa3bf' },
    { k: 'sofa2', n: 'Sofá 2 lugares', w: 160, d: 90, h: 85, sym: 'sofa', color: '#8fa3bf' },
    { k: 'sofaL', n: 'Sofá com chaise', w: 260, d: 160, h: 85, sym: 'sofaL', color: '#8fa3bf' },
    { k: 'poltrona', n: 'Poltrona', w: 80, d: 80, h: 90, sym: 'armchair', color: '#c9a27e' },
    { k: 'rack', n: 'Rack', w: 180, d: 45, h: 55, sym: 'cabinet', color: '#a98467' },
    { k: 'tv55', n: 'TV 55"', w: 124, d: 8, h: 72, sym: 'tv', color: '#2f3237', layer: 'wall', elev: 95 },
    { k: 'tv65', n: 'TV 65"', w: 146, d: 8, h: 84, sym: 'tv', color: '#2f3237', layer: 'wall', elev: 90 },
    { k: 'centro', n: 'Mesa de centro', w: 100, d: 60, h: 40, sym: 'table', color: '#b08d6e' },
    { k: 'lateral', n: 'Mesa lateral', w: 45, d: 45, h: 55, sym: 'roundtable', shape: 'round', color: '#b08d6e' },
    { k: 'estante', n: 'Estante', w: 120, d: 35, h: 180, sym: 'shelf', color: '#a98467' },
    { k: 'aparador', n: 'Aparador', w: 120, d: 40, h: 80, sym: 'cabinet', color: '#a98467' },
    { k: 'tapete', n: 'Tapete', w: 200, d: 150, h: 1, sym: 'rug', color: '#d8c3a5', layer: 'floor' },
    { k: 'lumin', n: 'Luminária de chão', w: 40, d: 40, h: 160, sym: 'lamp', shape: 'round', color: '#e8d27c' },
    { k: 'planta', n: 'Planta', w: 50, d: 50, h: 120, sym: 'plant', shape: 'round', color: '#6aa36f' },
  ]},
  { cat: 'Quarto', items: [
    { k: 'casal', n: 'Cama casal', w: 138, d: 188, h: 55, sym: 'bed', color: '#d9cbb8' },
    { k: 'queen', n: 'Cama queen', w: 158, d: 198, h: 55, sym: 'bed', color: '#d9cbb8' },
    { k: 'king', n: 'Cama king', w: 193, d: 203, h: 55, sym: 'bed', color: '#d9cbb8' },
    { k: 'solteiro', n: 'Cama solteiro', w: 88, d: 188, h: 50, sym: 'bed', color: '#d9cbb8' },
    { k: 'beliche', n: 'Beliche', w: 98, d: 198, h: 160, sym: 'bed', color: '#c7b49b' },
    { k: 'berco', n: 'Berço', w: 70, d: 130, h: 95, sym: 'crib', color: '#e6dccd' },
    { k: 'criado', n: 'Criado-mudo', w: 45, d: 40, h: 55, sym: 'cabinet', color: '#a98467' },
    { k: 'guarda', n: 'Guarda-roupa', w: 200, d: 55, h: 230, sym: 'wardrobe', color: '#b9a088' },
    { k: 'guarda3', n: 'Guarda-roupa 3 portas', w: 150, d: 55, h: 210, sym: 'wardrobe', color: '#b9a088' },
    { k: 'comoda', n: 'Cômoda', w: 120, d: 50, h: 90, sym: 'drawers', color: '#a98467' },
    { k: 'penteadeira', n: 'Penteadeira', w: 100, d: 45, h: 78, sym: 'desk', color: '#c4a98c' },
    { k: 'sapateira', n: 'Sapateira', w: 80, d: 35, h: 100, sym: 'cabinet', color: '#a98467' },
  ]},
  { cat: 'Cozinha e jantar', items: [
    { k: 'geladeira', n: 'Geladeira', w: 70, d: 75, h: 180, sym: 'fridge', color: '#dfe3e8' },
    { k: 'geladeira2', n: 'Geladeira duplex grande', w: 90, d: 75, h: 185, sym: 'fridge', color: '#dfe3e8' },
    { k: 'fogao', n: 'Fogão 4 bocas', w: 55, d: 62, h: 85, sym: 'stove', color: '#e4e6ea' },
    { k: 'fogao5', n: 'Fogão 5 bocas', w: 76, d: 66, h: 85, sym: 'stove', color: '#e4e6ea' },
    { k: 'pia', n: 'Pia com gabinete', w: 120, d: 55, h: 90, sym: 'sink', color: '#e9e4dc' },
    { k: 'balcao', n: 'Balcão / armário baixo', w: 80, d: 55, h: 90, sym: 'counter', color: '#e9e4dc' },
    { k: 'aereo', n: 'Armário aéreo', w: 80, d: 35, h: 70, sym: 'cabinet', color: '#e9e4dc', layer: 'wall', elev: 150 },
    { k: 'lavalouca', n: 'Lava-louças', w: 60, d: 60, h: 85, sym: 'washer', color: '#dfe3e8' },
    { k: 'micro', n: 'Micro-ondas', w: 50, d: 40, h: 30, sym: 'counter', color: '#cfd3d8', layer: 'wall', elev: 90 },
    { k: 'ilha', n: 'Ilha', w: 150, d: 90, h: 92, sym: 'counter', color: '#e9e4dc' },
    { k: 'mesa4', n: 'Mesa 4 lugares', w: 120, d: 80, h: 76, sym: 'table', color: '#b08d6e' },
    { k: 'mesa6', n: 'Mesa 6 lugares', w: 160, d: 90, h: 76, sym: 'table', color: '#b08d6e' },
    { k: 'mesar', n: 'Mesa redonda', w: 100, d: 100, h: 76, sym: 'roundtable', shape: 'round', color: '#b08d6e' },
    { k: 'cadeira', n: 'Cadeira', w: 45, d: 50, h: 90, sym: 'chair', color: '#9c7b5d' },
    { k: 'banqueta', n: 'Banqueta', w: 38, d: 38, h: 75, sym: 'stool', shape: 'round', color: '#9c7b5d' },
  ]},
  { cat: 'Banheiro', items: [
    { k: 'vaso', n: 'Vaso sanitário', w: 38, d: 65, h: 40, sym: 'toilet', color: '#f4f5f7' },
    { k: 'gabinete', n: 'Gabinete com cuba', w: 60, d: 45, h: 85, sym: 'basin', color: '#f4f5f7' },
    { k: 'box', n: 'Box de chuveiro', w: 90, d: 90, h: 190, sym: 'shower', color: '#cde3ef' },
    { k: 'banheira', n: 'Banheira', w: 170, d: 75, h: 55, sym: 'bathtub', color: '#f4f5f7' },
    { k: 'espelho', n: 'Espelheira', w: 60, d: 15, h: 60, sym: 'cabinet', color: '#cfe0ea', layer: 'wall', elev: 120 },
  ]},
  { cat: 'Lavanderia', items: [
    { k: 'lavadora', n: 'Máquina de lavar', w: 60, d: 65, h: 100, sym: 'washer', color: '#f0f1f3' },
    { k: 'secadora', n: 'Secadora', w: 60, d: 65, h: 85, sym: 'washer', color: '#f0f1f3' },
    { k: 'tanque', n: 'Tanque', w: 55, d: 50, h: 90, sym: 'basin', color: '#e9e4dc' },
    { k: 'armlav', n: 'Armário lavanderia', w: 70, d: 40, h: 180, sym: 'cabinet', color: '#e9e4dc' },
    { k: 'varal', n: 'Varal de chão', w: 150, d: 55, h: 100, sym: 'rack', color: '#c9ced6' },
  ]},
  { cat: 'Escritório', items: [
    { k: 'escriv', n: 'Escrivaninha', w: 120, d: 60, h: 75, sym: 'desk', color: '#c4a98c' },
    { k: 'escrivL', n: 'Mesa em L', w: 150, d: 150, h: 75, sym: 'deskL', color: '#c4a98c' },
    { k: 'cadesc', n: 'Cadeira de escritório', w: 60, d: 60, h: 110, sym: 'officechair', shape: 'round', color: '#4c5560' },
    { k: 'gaveteiro', n: 'Gaveteiro', w: 40, d: 50, h: 60, sym: 'drawers', color: '#a98467' },
    { k: 'livros', n: 'Estante de livros', w: 80, d: 30, h: 190, sym: 'shelf', color: '#a98467' },
  ]},
  { cat: 'Mudança', items: [
    { k: 'caixaP', n: 'Caixa P', w: 40, d: 30, h: 30, sym: 'box', color: '#c8a26b' },
    { k: 'caixaM', n: 'Caixa M', w: 50, d: 40, h: 40, sym: 'box', color: '#c8a26b' },
    { k: 'caixaG', n: 'Caixa G', w: 60, d: 50, h: 50, sym: 'box', color: '#c8a26b' },
    { k: 'mala', n: 'Mala', w: 70, d: 45, h: 28, sym: 'suitcase', color: '#3e5f8a' },
  ]},
  { cat: 'Outros', items: [
    { k: 'arcond', n: 'Ar-condicionado', w: 85, d: 22, h: 30, sym: 'ac', color: '#f2f3f5', layer: 'wall', elev: 210 },
    { k: 'bike', n: 'Bicicleta', w: 175, d: 60, h: 100, sym: 'bike', color: '#5a6b7d' },
    { k: 'piano', n: 'Piano digital', w: 135, d: 40, h: 80, sym: 'piano', color: '#2f3237' },
    { k: 'pet', n: 'Caminha pet', w: 70, d: 55, h: 20, sym: 'petbed', shape: 'round', color: '#c99b7b' },
    { k: 'ret', n: 'Bloco retangular', w: 100, d: 60, h: 80, sym: 'generic', color: '#a7b1bd' },
    { k: 'circ', n: 'Bloco redondo', w: 60, d: 60, h: 80, sym: 'generic', shape: 'round', color: '#a7b1bd' },
    { k: 'pilar', n: 'Pilar / coluna', w: 30, d: 30, h: 260, sym: 'pillar', color: '#9aa0a6' },
  ]},
];

export const ALL_DEFS = CATALOG.flatMap((c) => c.items.map((i) => ({ ...i, cat: c.cat })));

export const SYMBOLS = [
  ['generic', 'Bloco'], ['sofa', 'Sofá'], ['sofaL', 'Sofá em L'], ['armchair', 'Poltrona'], ['bed', 'Cama'], ['crib', 'Berço'],
  ['table', 'Mesa'], ['roundtable', 'Mesa redonda'], ['chair', 'Cadeira'], ['stool', 'Banqueta'], ['desk', 'Escrivaninha'],
  ['deskL', 'Mesa em L'], ['officechair', 'Cadeira giratória'], ['cabinet', 'Armário / rack'], ['wardrobe', 'Guarda-roupa'],
  ['drawers', 'Gaveteiro / cômoda'], ['shelf', 'Estante'], ['tv', 'TV'], ['fridge', 'Geladeira'], ['stove', 'Fogão'],
  ['sink', 'Pia'], ['counter', 'Balcão'], ['washer', 'Máquina'], ['toilet', 'Vaso'], ['basin', 'Cuba / tanque'],
  ['shower', 'Box'], ['bathtub', 'Banheira'], ['rug', 'Tapete'], ['lamp', 'Luminária'], ['plant', 'Planta'], ['box', 'Caixa'],
  ['suitcase', 'Mala'], ['ac', 'Ar-condicionado'], ['bike', 'Bicicleta'], ['piano', 'Piano'], ['petbed', 'Caminha pet'],
  ['rack', 'Varal'], ['pillar', 'Pilar'],
];

export const COLORS = ['#8fa3bf', '#c9a27e', '#b08d6e', '#a98467', '#d9cbb8', '#e9e4dc', '#dfe3e8', '#2f3237', '#6aa36f', '#c8a26b', '#d98e73', '#9b8ec4', '#e8d27c', '#5a6b7d', '#f4f5f7', '#c97b8e'];
export const FLOOR_COLORS = ['#efe6d8', '#e3d2b8', '#c9a77f', '#ddd9d2', '#cfd6dc', '#e9e1f0', '#dbe8d9', '#f3efe7'];

export const ROOM_NAMES = ['Sala', 'Quarto', 'Suíte', 'Cozinha', 'Banheiro', 'Área de serviço', 'Escritório', 'Varanda', 'Corredor', 'Closet', 'Sala de jantar', 'Garagem'];

export const STATUS = {
  tenho: { n: 'Já tenho', c: '#2f855a' },
  comprar: { n: 'Comprar', c: '#c05621' },
  decidir: { n: 'Decidir', c: '#6b46c1' },
  sai: { n: 'Não vai', c: '#718096' },
};

export const OPENING_TYPES = {
  door: { n: 'Porta', w: 80, h: 210, sill: 0 },
  door2: { n: 'Porta dupla', w: 140, h: 210, sill: 0 },
  slide: { n: 'Porta de correr', w: 160, h: 210, sill: 0 },
  window: { n: 'Janela', w: 120, h: 110, sill: 100 },
  pass: { n: 'Vão / passagem', w: 90, h: 210, sill: 0 },
};
