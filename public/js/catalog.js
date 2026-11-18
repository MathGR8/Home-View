// Catálogo de móveis com medidas comuns no Brasil (largura × profundidade × altura, em cm).
// sym = desenho na planta e modelo no 3D. layer: normal | floor (tapete) | wall (na parede) | struct (mezanino, escada).
// Estruturas: h = altura do piso do mezanino / altura que a escada sobe.
// Área externa: muro (h2 = altura no fim, para muro/parede inclinada), grade (pattern), portão (style), piso (tex).
// Iluminação (layer wall): elev = altura do chão até a lâmpada; h = comprimento do pendente. ceil = presa no teto (a altura acompanha o pé-direito).
// Carros: model = hatch | sedan | suv. Frente do carro em +y (desenho).

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
    { k: 'monitor24', n: 'Monitor 24"', w: 54, d: 20, h: 42, sym: 'monitor', color: '#24272b', layer: 'wall', elev: 75 },
    { k: 'monitor27', n: 'Monitor 27"', w: 62, d: 22, h: 48, sym: 'monitor', color: '#24272b', layer: 'wall', elev: 75 },
    { k: 'monitor34', n: 'Monitor ultrawide 34"', w: 82, d: 24, h: 50, sym: 'monitor', color: '#24272b', layer: 'wall', elev: 75 },
    { k: 'pc', n: 'Computador (gabinete)', w: 21, d: 45, h: 46, sym: 'pc', color: '#2b2f33' },
    { k: 'pcmesa', n: 'Computador em cima da mesa', w: 21, d: 45, h: 46, sym: 'pc', color: '#2b2f33', layer: 'wall', elev: 75 },
    { k: 'notebook', n: 'Notebook (aberto)', w: 36, d: 25, h: 23, sym: 'laptop', color: '#9aa1a9', layer: 'wall', elev: 75 },
    { k: 'teclado', n: 'Teclado e mouse', w: 58, d: 16, h: 3, sym: 'keyboard', color: '#2f3237', layer: 'wall', elev: 75 },
    { k: 'impressora', n: 'Impressora', w: 45, d: 36, h: 22, sym: 'printer', color: '#e4e6ea', layer: 'wall', elev: 75 },
  ]},
  { cat: 'Garagem', items: [
    { k: 'hatch', n: 'Carro hatch', w: 180, d: 410, h: 150, sym: 'car', model: 'hatch', color: '#b8432f' },
    { k: 'seda', n: 'Carro sedã', w: 180, d: 465, h: 147, sym: 'car', model: 'sedan', color: '#c9ced6' },
    { k: 'suv', n: 'Carro SUV', w: 190, d: 455, h: 170, sym: 'car', model: 'suv', color: '#2b2f33' },
    { k: 'moto', n: 'Moto', w: 80, d: 205, h: 115, sym: 'moto', color: '#2f5f8a' },
  ]},
  { cat: 'Mudança', items: [
    { k: 'caixaP', n: 'Caixa P', w: 40, d: 30, h: 30, sym: 'box', color: '#c8a26b' },
    { k: 'caixaM', n: 'Caixa M', w: 50, d: 40, h: 40, sym: 'box', color: '#c8a26b' },
    { k: 'caixaG', n: 'Caixa G', w: 60, d: 50, h: 50, sym: 'box', color: '#c8a26b' },
    { k: 'mala', n: 'Mala', w: 70, d: 45, h: 28, sym: 'suitcase', color: '#3e5f8a' },
  ]},
  { cat: 'Estrutura', items: [
    { k: 'mezz', n: 'Mezanino metálico', w: 300, d: 250, h: 280, sym: 'mezz', layer: 'struct', color: '#3c4650', deck: '#8b939c', thick: 12, railH: 110, rails: 'nsew' },
    { k: 'escada', n: 'Escada reta', w: 90, d: 400, h: 280, sym: 'stair', layer: 'struct', color: '#3c4650', deck: '#8b939c', steps: 0, railH: 90, rails: 'we' },
    { k: 'escada60', n: 'Escada íngreme (60°)', w: 70, d: 162, h: 280, sym: 'stair', layer: 'struct', color: '#3c4650', deck: '#8b939c', steps: 12, railH: 90, rails: 'we' },
  ]},
  { cat: 'Área externa', items: [
    { k: 'muro', n: 'Muro', w: 300, d: 15, h: 200, sym: 'wallseg', color: '#d9d4ca' },
    { k: 'mureta', n: 'Mureta', w: 200, d: 15, h: 100, sym: 'wallseg', color: '#d9d4ca' },
    { k: 'paredeInc', n: 'Parede inclinada (embaixo da escada)', w: 250, d: 10, h: 260, h2: 40, sym: 'wallseg', color: '#f4f2ee' },
    { k: 'paredeDiv', n: 'Parede divisória', w: 200, d: 10, h: 260, sym: 'wallseg', color: '#f4f2ee' },
    { k: 'gradeV', n: 'Grade vertical', w: 200, d: 5, h: 120, sym: 'fence', pattern: 'vertical', color: '#2b2f33' },
    { k: 'gradeD', n: 'Grade diagonal', w: 200, d: 5, h: 120, sym: 'fence', pattern: 'diagonal', color: '#2b2f33' },
    { k: 'gradeX', n: 'Grade em losango (diagonal cruzada)', w: 200, d: 5, h: 120, sym: 'fence', pattern: 'cross', color: '#2b2f33' },
    { k: 'gradeM', n: 'Grade vertical + diagonal', w: 200, d: 5, h: 120, sym: 'fence', pattern: 'mixed', color: '#2b2f33' },
    { k: 'portao', n: 'Portão de garagem (basculante)', w: 300, d: 8, h: 230, sym: 'gate', style: 'panel', color: '#5d6670' },
    { k: 'portaoG', n: 'Portão de garagem (grade)', w: 300, d: 6, h: 220, sym: 'gate', style: 'bars', color: '#2b2f33' },
    { k: 'portaoR', n: 'Portão de garagem (ripado)', w: 300, d: 8, h: 230, sym: 'gate', style: 'slats', color: '#7a5c43' },
    { k: 'portaoS', n: 'Portão social (pedestre)', w: 100, d: 6, h: 210, sym: 'gate', style: 'bars', color: '#2b2f33' },
    { k: 'grama', n: 'Grama', w: 400, d: 300, h: 1, sym: 'ground', tex: 'grass', color: '#7fae5a', layer: 'floor' },
    { k: 'concreto', n: 'Piso de concreto', w: 300, d: 300, h: 1, sym: 'ground', tex: 'concrete', color: '#bdbab4', layer: 'floor' },
    { k: 'ceramico', n: 'Piso cerâmico', w: 300, d: 300, h: 1, sym: 'ground', tex: 'tiles', color: '#d9d4ca', layer: 'floor' },
    { k: 'deckM', n: 'Deck de madeira', w: 300, d: 200, h: 1, sym: 'ground', tex: 'deck', color: '#a8784f', layer: 'floor' },
    { k: 'pedra', n: 'Pedrisco / cascalho', w: 200, d: 200, h: 1, sym: 'ground', tex: 'gravel', color: '#b9b2a6', layer: 'floor' },
    { k: 'terra', n: 'Terra / canteiro', w: 200, d: 100, h: 1, sym: 'ground', tex: 'soil', color: '#8a6a4f', layer: 'floor' },
    { k: 'pisoMad', n: 'Piso de madeira', w: 300, d: 300, h: 1, sym: 'ground', tex: 'wood', color: '#b98a5e', layer: 'floor' },
    { k: 'porcel', n: 'Porcelanato', w: 300, d: 300, h: 1, sym: 'ground', tex: 'porcelain', color: '#e4e1dc', layer: 'floor' },
    { k: 'cimento', n: 'Cimento queimado', w: 300, d: 300, h: 1, sym: 'ground', tex: 'cement', color: '#a9a8a4', layer: 'floor' },
  ]},
  { cat: 'Elétrica e luz', items: [
    { k: 'lampada', n: 'Lâmpada (teto)', w: 12, d: 12, h: 18, sym: 'bulb', shape: 'round', color: '#fff3c4', layer: 'wall', elev: 242, ceil: true },
    { k: 'pendente', n: 'Luminária pendente', w: 35, d: 35, h: 60, sym: 'pendant', shape: 'round', color: '#2b2f33', layer: 'wall', elev: 200, ceil: true },
    { k: 'industrial', n: 'Iluminação industrial (4 lâmpadas)', w: 200, d: 20, h: 50, sym: 'indlight', bulbs: 4, color: '#2b2f33', layer: 'wall', elev: 170, ceil: true },
    { k: 'industrial6', n: 'Iluminação industrial (6 lâmpadas)', w: 300, d: 20, h: 50, sym: 'indlight', bulbs: 6, color: '#2b2f33', layer: 'wall', elev: 170, ceil: true },
    { k: 'plafon', n: 'Plafon (luminária de teto)', w: 30, d: 30, h: 8, sym: 'ceilinglamp', shape: 'round', color: '#f4f5f7', layer: 'wall', elev: 252, ceil: true },
    { k: 'spot', n: 'Spot embutido', w: 10, d: 10, h: 3, sym: 'ceilinglamp', shape: 'round', color: '#d8dadd', layer: 'wall', elev: 257, ceil: true },
    { k: 'tomada', n: 'Tomada (baixa)', w: 8, d: 2, h: 12, sym: 'socket', mods: 1, color: '#f4f5f7', layer: 'wall', elev: 30 },
    { k: 'tomada2', n: 'Tomada dupla (bancada)', w: 12, d: 2, h: 12, sym: 'socket', mods: 2, color: '#f4f5f7', layer: 'wall', elev: 110 },
    { k: 'tomadaA', n: 'Tomada alta (ar / TV)', w: 8, d: 2, h: 12, sym: 'socket', mods: 1, color: '#f4f5f7', layer: 'wall', elev: 220 },
    { k: 'interr', n: 'Interruptor', w: 8, d: 2, h: 12, sym: 'switch', mods: 1, color: '#f4f5f7', layer: 'wall', elev: 110 },
    { k: 'interr2', n: 'Interruptor duplo', w: 8, d: 2, h: 12, sym: 'switch', mods: 2, color: '#f4f5f7', layer: 'wall', elev: 110 },
  ]},
  { cat: 'Pets', items: [
    { k: 'frajola', n: 'Gato frajola', w: 22, d: 46, h: 28, sym: 'cat', coat: 'frajola', color: '#1d1d20' },
    { k: 'rajadinha', n: 'Gata rajadinha', w: 20, d: 44, h: 26, sym: 'cat', coat: 'rajada', color: '#8f8270' },
    { k: 'coelha', n: 'Coelha preta', w: 20, d: 36, h: 22, sym: 'rabbit', color: '#1c1b1d' },
    { k: 'areia', n: 'Caixa de areia', w: 50, d: 38, h: 15, sym: 'litter', color: '#4f8fbf' },
    { k: 'pet', n: 'Caminha pet', w: 70, d: 55, h: 20, sym: 'petbed', shape: 'round', color: '#c99b7b' },
  ]},
  { cat: 'Pessoas', items: [
    { k: 'homem', n: 'Homem', w: 48, d: 26, h: 175, sym: 'person', gender: 'm', color: '#3e5f8a' },
    { k: 'mulher', n: 'Mulher', w: 42, d: 24, h: 163, sym: 'person', gender: 'f', color: '#b0475f' },
  ]},
  { cat: 'Outros', items: [
    { k: 'arcond', n: 'Ar-condicionado', w: 85, d: 22, h: 30, sym: 'ac', color: '#f2f3f5', layer: 'wall', elev: 210 },
    { k: 'bike', n: 'Bicicleta', w: 175, d: 60, h: 100, sym: 'bike', color: '#5a6b7d' },
    { k: 'piano', n: 'Piano digital', w: 135, d: 40, h: 80, sym: 'piano', color: '#2f3237' },
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
  ['wallseg', 'Muro / parede'], ['fence', 'Grade'], ['gate', 'Portão'], ['ground', 'Piso externo'],
  ['bulb', 'Lâmpada'], ['pendant', 'Luminária pendente'], ['indlight', 'Iluminação industrial'], ['socket', 'Tomada'], ['switch', 'Interruptor'],
  ['cat', 'Gato'], ['rabbit', 'Coelho'], ['litter', 'Caixa de areia'], ['person', 'Pessoa'],
  ['ceilinglamp', 'Plafon / spot'], ['monitor', 'Monitor'], ['pc', 'Computador'], ['laptop', 'Notebook'], ['keyboard', 'Teclado e mouse'], ['printer', 'Impressora'],
  ['car', 'Carro'], ['moto', 'Moto'],
];

// Opções dos itens especiais
export const FENCE_PATTERNS = { vertical: 'Vertical', diagonal: 'Diagonal', cross: 'Losango', mixed: 'Vertical + diagonal' };
export const GATE_STYLES = { panel: 'Chapa (basculante)', bars: 'Grade', slats: 'Ripado' };
export const GROUND_TEX = {
  grass: ['Grama', '#7fae5a'], concrete: ['Concreto', '#bdbab4'], tiles: ['Cerâmico', '#d9d4ca'],
  deck: ['Deck', '#a8784f'], gravel: ['Pedrisco', '#b9b2a6'], soil: ['Terra', '#8a6a4f'],
  wood: ['Madeira', '#b98a5e'], porcelain: ['Porcelanato', '#e4e1dc'], cement: ['Cimento queimado', '#a9a8a4'],
};
// Pisos dos cômodos: liso (só a cor) ou com textura
export const FLOOR_TYPES = {
  plain: ['Liso', null], wood: ['Madeira', '#b98a5e'], porcelain: ['Porcelanato', '#e4e1dc'], tiles: ['Cerâmica', '#d9d4ca'],
  cement: ['Cimento queimado', '#a9a8a4'], concrete: ['Concreto', '#bdbab4'], deck: ['Deck', '#a8784f'],
  grass: ['Grama', '#7fae5a'], soil: ['Terra', '#8a6a4f'], gravel: ['Pedrisco', '#b9b2a6'],
};
export const CAR_MODELS = { hatch: ['Hatch', 180, 410, 150], sedan: ['Sedã', 180, 465, 147], suv: ['SUV', 190, 455, 170] };
export const CAT_COATS = { frajola: ['Frajola', '#1d1d20'], rajada: ['Rajadinha', '#8f8270'], laranja: ['Laranja', '#d28a45'], preto: ['Preto', '#1d1d20'], branco: ['Branco', '#f1efea'] };
// Itens que não contam como "batendo" (muros, grades, luz, pessoas, pets…)
export const NO_CLASH = new Set(['wallseg', 'fence', 'gate', 'ground', 'bulb', 'pendant', 'indlight', 'socket', 'switch', 'person', 'cat', 'rabbit', 'ceilinglamp', 'monitor', 'laptop', 'keyboard', 'printer']);
export const LIGHT_SYMS = new Set(['bulb', 'pendant', 'indlight', 'ceilinglamp']);

export const COLORS = ['#8fa3bf', '#c9a27e', '#b08d6e', '#a98467', '#d9cbb8', '#e9e4dc', '#dfe3e8', '#2f3237', '#6aa36f', '#c8a26b', '#d98e73', '#9b8ec4', '#e8d27c', '#5a6b7d', '#f4f5f7', '#c97b8e'];
export const FLOOR_COLORS = ['#efe6d8', '#e3d2b8', '#c9a77f', '#b98a5e', '#ddd9d2', '#e4e1dc', '#cfd6dc', '#a9a8a4', '#e9e1f0', '#dbe8d9', '#f3efe7', '#7fae5a', '#8a6a4f', '#bdbab4'];

export const ROOM_NAMES = ['Sala', 'Quarto', 'Suíte', 'Cozinha', 'Banheiro', 'Área de serviço', 'Escritório', 'Varanda', 'Corredor', 'Closet', 'Sala de jantar', 'Garagem', 'Lavabo', 'Quintal', 'Área externa'];
export const OUTDOOR_NAMES = new Set(['Quintal', 'Área externa']);

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
  garage: { n: 'Portão de garagem', w: 250, h: 220, sill: 0 },
  cut: { n: 'Corte (sem parede)', w: 100, h: 0, sill: 0 },
};
