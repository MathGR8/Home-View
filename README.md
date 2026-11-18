# Home-View

App para planejar a mudança e a reforma: monte a planta dos cômodos com as medidas reais, coloque os móveis e organize tudo arrastando, na vista de cima e em 3D. Funciona no computador e no celular, salva sozinho e pode guardar os projetos na nuvem.

## O que dá para fazer

- **Cômodos** retangulares ou em L, com medidas internas, pé-direito, espessura de parede e cor do piso. Arraste as paredes e os cantos, divida paredes para criar formatos livres e digite o comprimento exato de cada parede. Os cômodos encaixam parede com parede.
- **Portas, janelas e vãos** em qualquer parede: porta comum (com lado da dobradiça e se abre para dentro ou para fora), porta dupla, porta de correr, janela com peitoril e vão livre. Arraste na planta para mudar de posição, inclusive para outra parede.
- **Móveis**: catálogo com cerca de 80 itens e medidas comuns (sala, quarto, cozinha, banheiro, lavanderia, escritório, caixas de mudança…), ou crie os seus com as medidas que quiser e guarde em “Meus móveis”.
- **Organizar**: arrastar, girar (de 15 em 15°, ou livre), redimensionar, duplicar, copiar e colar, travar a posição e desfazer/refazer.
  - **Ímã**: encaixa nas paredes, nos cantos, no centro do cômodo e nas bordas dos outros móveis, com linhas-guia.
  - **Distâncias** em azul até a parede ou o próximo móvel. Toque numa delas para digitar a medida exata.
  - **Encostar** (setas): empurra até a parede ou o próximo móvel. **Centralizar** entre os obstáculos.
  - **Vários de uma vez**: alinhar, distribuir com espaços iguais ou com espaço fixo, girar o grupo.
  - **Avisos** de móveis batendo em outros ou atravessando paredes. Cadeiras podem ficar embaixo da mesa.
- **Régua** para medir qualquer ponto da planta (gruda nos cantos).
- **Lista da mudança**: cada item pode ser “Já tenho”, “Comprar”, “Decidir” ou “Não vai”, com preço e anotações. Mostra o total a comprar e exporta para planilha (CSV).
- **Mezanino metálico e escadas**: piso suspenso com altura, espessura, pilares, vigas e guarda-corpo (lados escolhidos); escadas retas com qualquer giro na planta e qualquer inclinação, cálculo de degraus (espelho, piso e conforto) e botão para encaixar no mezanino. O guarda-corpo abre sozinho onde a escada chega. Móveis podem ficar em cima do mezanino.
- **Mezanino sem pernas**: escolha pilares em todos os pontos, só nos cantos ou nenhum (preso nas paredes), ou tire um pilar específico tocando nele no 3D.
- **Cortar paredes**: corte um trecho de qualquer parede (sem parede, ou deixando uma mureta/meia-parede), tire a parede inteira ou devolva depois. Funciona na planta e tocando na parede no 3D. Junto com a **parede divisória** e a **parede inclinada** (altura diferente no início e no fim) dá para montar, por exemplo, um banheiro embaixo da escada.
- **Área externa**: cômodos sem paredes (quintal), pisos de grama, concreto, cerâmico, deck, pedrisco e terra, muros e muretas independentes, grades (vertical, diagonal, losango ou vertical + diagonal) e portões de garagem (basculante, grade, ripado) e social. Também há “Portão de garagem” como abertura na parede de um cômodo.
- **Elétrica e luz**: lâmpadas, luminária pendente, iluminação industrial com várias lâmpadas, tomadas (baixa, média, alta, dupla, padrão brasileiro) e interruptores. No 3D, o modo **Noite** acende as lâmpadas.
- **Pets e pessoas**: gato frajola, gata rajadinha, coelha preta, caixa de areia; um homem e uma mulher com altura ajustável para comparar com móveis e bancadas, e o botão **Ver pelos olhos no 3D** para ver o ambiente na altura dos olhos de cada um.
- **3D**: perspectiva, vista de cima e **Andar** (primeira pessoa, sobe escadas, anda no mezanino, ou voa livre), com paredes altas, baixas ou sem paredes. Dois controles na tela, como num jogo: o da esquerda anda e o da direita gira a câmera (para a direita gira no sentido horário, para a esquerda no anti-horário, para cima/baixo olha para cima/baixo). No computador: WASD anda e ←/→ giram. Toque num objeto no 3D para selecionar, apagar, tirar um pilar ou guarda-corpo, cortar a parede ali, etc.
- **Projetos**: crie, duplique, renomeie, apague, exporte e importe arquivos. Também dá para salvar a imagem da planta (PNG) e imprimir a planta com a lista.
- **Nuvem**: com uma conta (só usuário e senha), os projetos ficam guardados no Cloudflare e aparecem em todos os aparelhos.
- Funciona sem internet e pode ser instalado na tela inicial do celular (PWA).

## Estrutura

```
public/        o app (HTML, CSS e JavaScript puro, sem etapa de build)
  js/plan.js     editor 2D (SVG): desenho, arrastar, encaixe, girar, medir
  js/view3d.js   visualização 3D (Three.js) e navegação (andar/voar)
  js/struct.js   mezanino e escadas (degraus, guarda-corpo, piso para caminhar)
  js/state.js    modelo do projeto, desfazer/refazer, exemplo
  js/storage.js  salvamento local e na nuvem
  js/catalog.js  catálogo de móveis
worker/index.js  API (contas e projetos) + Durable Object com SQLite
wrangler.jsonc   configuração do Cloudflare
```

## Publicar no Cloudflare

1. No painel do Cloudflare: **Workers e Pages → Criar → Importar um repositório** e escolha este repositório.
2. Nome do projeto: `home-view`. Ele precisa ser igual ao `name` em `wrangler.jsonc`; se usar outro nome, altere lá também.
3. Deixe o comando de build vazio. O comando de deploy é `npx wrangler deploy`, que é o padrão.
4. Clique em **Implantar**. A cada push no GitHub o site é atualizado sozinho.

O banco de dados (Durable Object com SQLite) é criado automaticamente e está incluído no plano gratuito. Não é preciso configurar nada no painel.

## Rodar no computador

```bash
npm install
npm run dev
```

Depois abra http://localhost:8787.
