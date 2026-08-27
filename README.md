# Jovens e Teens AD CRM

Crie um aplicativo web em **React + TypeScript + Vite + Tailwind CSS + shadcn/ui**, com backend

**Supabase (Lovable Cloud)**. É o CRM interno do ministério de jovens e adolescentes

**"Jovens e Teens AD"**, chamado **AD CRM**. Toda a interface em **português do Brasil**, com tom

acolhedor e pastoral (não corporativo).




Nesta mensagem, construa **apenas a fundação**: design system, banco de dados, autenticação e a

casca de navegação. **Não construa ainda o conteúdo das páginas internas** — crie cada rota como

uma página vazia com só o título, que eu vou preencher nas próximas mensagens.




### 1. Design system




Tokens CSS em `:root` e `.dark`, expostos como utilitários Tailwind (`bg-jt-panel`, `text-jt-muted`,

`border-jt-line`, `bg-jt-blue`, etc.):




| Token | Claro | Escuro |

|-------|-------|--------|

| `--jt-bg` | `#ffffff` | `#0a0a0a` |

| `--jt-bg-top` | `#f8fafc` | `#121212` |

| `--jt-panel` | `#ffffff` | `#141414` |

| `--jt-panel-2` | `#f8fafc` | `#1e1e1e` |

| `--jt-blue` | `#0f172a` | `#2563eb` |

| `--jt-gold` | `#1d4ed8` | `#60a5fa` |

| `--jt-coral` | `#dc2626` | `#f87171` |

| `--jt-text` | `#0f172a` | `#ededed` |

| `--jt-muted` | `#64748b` | `#a1a1a1` |

| `--jt-success` | `#16a34a` | `#4ade80` |

| `--jt-line` | `rgba(15,23,42,.12)` | `rgba(255,255,255,.14)` |




Tipografia: títulos em **Bricolage Grotesque** (`font-display`), texto em **Inter** (`font-sans`),

números em **IBM Plex Mono**. Raio base `0.625rem`, cartões `rounded-xl`. Botão principal em pílula:

`rounded-full`, altura 40px, `bg-jt-blue text-white`, sombra `0 12px 34px -14px rgba(15,23,42,0.45)`,

`hover:brightness-110`. Superfícies `bg-jt-panel` sobre fundo `bg-jt-panel-2`, bordas de 1px

`border-jt-line`, sem sombras pesadas nos cartões, ícones **lucide-react** de 16–20px.

Carregamento e estados vazios sempre como texto centralizado dentro de um painel com borda.




### 2. Banco de dados




```sql

create type public.app_role as enum ('admin', 'user');




create table public.user_roles (

  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  role public.app_role not null,

  created_at timestamptz not null default now(),

  unique (user_id, role)

);




create table public.congregacoes (

  id uuid primary key default gen_random_uuid(),

  nome text not null unique,

  status text not null default 'ativa' check (status in ('ativa','inativa')),

  endereco text not null,

  numero text,

  bairro text not null,

  cidade text not null,

  estado char(2) not null,

  cep text not null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);




create table public.cadastros (

  id uuid primary key default gen_random_uuid(),

  user_id uuid,

  nome_completo text not null,

  data_nascimento date not null,

  cpf text not null,

  rg text not null,

  telefone text not null,

  email text not null,

  congregacao_id uuid references public.congregacoes(id),

  endereco text not null,

  numero text,

  complemento text,

  cidade text not null,

  cep text not null,

  compartilhou_dados_complementares boolean not null default false,

  escolaridade text,

  local_estudo text,

  curso text,

  estado_civil text,

  trabalha_atualmente boolean,

  renda_mensal text,

  mora_com_pais boolean,

  renda_familiar text,

  lgpd_aceito boolean not null,

  data_cadastro timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint cadastros_cpf_unico unique (cpf),

  constraint cadastros_lgpd_obrigatorio check (lgpd_aceito = true)

);




create table public.composicao_familiar (

  id uuid primary key default gen_random_uuid(),

  cadastro_id uuid not null references public.cadastros(id) on delete cascade,

  nome_completo text not null,

  parentesco text,

  idade integer,

  ocupacao text,

  created_at timestamptz not null default now()

);




create table public.module_access (

  user_id uuid not null,

  module_key text not null check (module_key in

    ('congregacoes','congregacoes_gerenciar','ebd','ebd_chamada','ebd_turmas')),

  granted_by uuid,

  granted_at timestamptz not null default now(),

  primary key (user_id, module_key)

);




create table public.ebd_turmas (

  id uuid primary key default gen_random_uuid(),

  nome text not null,

  congregacao_id uuid not null references public.congregacoes(id),

  idade_min integer not null,

  idade_max integer not null check (idade_max >= idade_min),

  created_at timestamptz not null default now()

);




create table public.ebd_matriculas (

  id uuid primary key default gen_random_uuid(),

  turma_id uuid not null references public.ebd_turmas(id) on delete cascade,

  cadastro_id uuid not null references public.cadastros(id),

  created_at timestamptz not null default now(),

  unique (turma_id, cadastro_id)

);




create table public.ebd_aulas (

  id uuid primary key default gen_random_uuid(),

  turma_id uuid not null references public.ebd_turmas(id) on delete cascade,

  nome text not null,

  data date not null,

  hora_inicio time not null,

  hora_fim time not null check (hora_fim > hora_inicio),

  created_at timestamptz not null default now(),

  constraint ebd_aulas_turma_data_unico unique (turma_id, data)

);




create table public.ebd_frequencia (

  id uuid primary key default gen_random_uuid(),

  turma_id uuid not null references public.ebd_turmas(id) on delete cascade,

  cadastro_id uuid not null references public.cadastros(id),

  data date not null,

  presente boolean not null,

  created_at timestamptz not null default now(),

  unique (turma_id, cadastro_id, data)

);




create table public.auditoria (

  id uuid primary key default gen_random_uuid(),

  user_id uuid,

  user_nome text not null default '—',

  acao text not null,

  entidade text not null,

  entidade_id uuid,

  detalhe text,

  created_at timestamptz not null default now()

);

```




Habilite **RLS em todas** as tabelas e crie duas funções `SECURITY DEFINER` com

`set search_path = public`:




- `has_role(_user_id uuid, _role app_role) returns boolean` — consulta `user_roles`.

- `has_module_access(_user_id uuid, _module text) returns boolean` — **`true` se a pessoa for admin

  OU tiver a chave em `module_access`**. Admin sempre passa por aqui.




Nunca guarde papel ou permissão no perfil do usuário nem no JWT do cliente — sempre nessas tabelas,

consultadas por essas funções, para não haver escalada de privilégio via RLS.




Políticas:




- `cadastros`: a pessoa lê o **próprio** cadastro (`user_id = auth.uid()`); admin lê todos; inserção

  para autenticados **apenas com `lgpd_aceito = true`**.

- `composicao_familiar`: mesma lógica, pelo cadastro dono.

- `congregacoes`: leitura com `has_module_access('congregacoes')`; escrita e exclusão só com

  `has_module_access('congregacoes_gerenciar')`.

- `ebd_turmas`, `ebd_matriculas`, `ebd_aulas`, `ebd_frequencia`: leitura com `has_module_access('ebd')`;

  criar turma exige `ebd_turmas`; matricular e lançar chamada exigem `ebd_chamada`.

- `auditoria`: a pessoa lê os próprios registros; admin lê tudo.




### 3. Autenticação




Tela `/auth` com login e cadastro por e-mail/senha, em duas colunas (formulário à esquerda, imagem à

direita), na mesma paleta. Sessão persistida, refresh automático, redirecionamento para `/inicio`

após entrar, e proteção de todas as rotas internas.




Crie um hook que carrega **uma única vez** o acesso da conta no formato `{ isAdmin, modules[] }`,

usado para filtrar menu e botões. A validação real é sempre do banco via RLS — o filtro do front

existe só para não oferecer link que a pessoa não pode abrir. Sem permissão, a área mostra um painel

com: *"Sua conta não tem permissão de liderança para ver esta área."*




### 4. Navegação como fonte única




Crie `src/lib/nav.ts` descrevendo **toda** a navegação numa única estrutura de dados — rota, rótulo,

descrição curta, ícone e regra de permissão. Essa mesma estrutura alimenta a barra lateral, os

cartões de atalho do Menu inicial e as migalhas de pão: registrar uma rota ali basta para ela

aparecer nos três lugares com a mesma regra.




Grupo **"Menu"**:




| Rota | Rótulo | Descrição | Ícone | Permissão |

|------|--------|-----------|-------|-----------|

| `/inicio` | Menu inicial | Atalhos, pendências e resumo do seu acesso. | `LayoutGrid` | todos |

| `/` | Complementar cadastro | Complete ou revise os seus dados no ministério. | `ClipboardCheck` | todos |

| `/congregacoes` | Congregações | Congregações cadastradas e seus membros vinculados. | `Church` | módulo `congregacoes` |

| `/ebd` | EBD | Turmas, aulas e frequência da Escola Bíblica Dominical. | `GraduationCap` | módulo `ebd` |




Subitens: Congregações → **Painel** (`/congregacoes/painel`) e **Lista** (`/congregacoes/lista`);

EBD → **Painel** (`/ebd/painel`), **Turmas** (`/ebd/turmas`) e **Cadastrar aulas** (`/ebd/aulas`).

`/congregacoes` e `/ebd` redirecionam para o respectivo Painel. Grupo **"Sistema"**: **Meu usuário**

(`/perfil`), com "Meus dados".




### 5. Casca da aplicação (AppShell)




Todas as telas autenticadas usam a mesma casca:




- **Barra lateral** `bg-jt-panel`, 256px expandida / 68px recolhida (só ícones). Topo: logo linkando

  para o Menu inicial. Itens agrupados sob "Menu" e "Sistema" (caixa alta, 11px, `tracking-wider`,

  `text-jt-muted`). Item ativo: `bg-jt-blue/10`, `text-jt-blue`, `font-medium`. Itens com subpáginas

  abrem em **sanfona** (chevron girando 180°), e entrar na área abre a sanfona sozinha. No rodapé da

  barra: avatar, nome e e-mail da conta, com menu de opções.

- **Header** de 56px, `backdrop-blur`, borda inferior: botão de recolher/expandir a barra, busca

  global, e à direita configurações, sino de notificações e avatar.

- **Conteúdo** com largura máxima de 1400px e **migalhas de pão** no formato

  `Menu inicial › Área › Subpágina` (o "Menu inicial" é a raiz fixa e não aparece na própria home).

- **Responsivo**: abaixo de 768px a barra vira gaveta sobre o conteúdo com overlay escuro; de 768 a

  1024px fica como trilho de ícones; acima disso respeita a preferência da pessoa, guardada em

  `localStorage` na chave `jt-sidebar-recolhido`.




### 6. Dois grupos de componentes reutilizáveis




**Formulário guiado** (`src/components/cadastro/ui.tsx`): `Eyebrow` (rótulo de etapa em caixa alta,

11px, `tracking-[0.18em]`), `Panel`, `PillButton` (sólido/outline/ghost), `Field` (rótulo + erro em

vermelho + dica), `TextInput`, `DateInput`, `SelectInput`, `YesNoToggle` (dois botões Sim/Não) e

`ProgressTrail` (trilha de etapas numeradas, atual em `jt-blue`, concluídas com check). Máscaras:

CPF `000.000.000-00`, RG `00.000.000-0`, telefone `(00) 00000-0000`, CEP `00000-000`.




**Tabela administrativa** (`src/components/crm/data-table.tsx`), usada por todas as listas do

sistema: busca por texto, menu de **filtros** com contador de filtros ativos, menu de **colunas

visíveis**, botão de **agrupar por** (insere linhas de cabeçalho de grupo com contagem), **ordenação**

ao clicar no cabeçalho, **paginação** 10/25/50/100 (padrão 10) e linha de estado vazio

("Nenhum item corresponde aos filtros."). As preferências persistem enquanto a pessoa navega.




### 7. Regras gerais do sistema




- Toda escrita valida a permissão **no banco** antes de gravar, mesmo com o botão escondido no front.

  Erros previsíveis (sem permissão, duplicado, em uso) viram mensagens claras em português, nunca

  stack trace.

- Datas exibidas em `dd/mm/aaaa` e gravadas em ISO (`aaaa-mm-dd`); horários em `HH:MM`.

- Toda criação, edição e exclusão relevante grava em `auditoria` quem fez, a ação, a entidade e um

  detalhe legível.

- `aria-label` em todo botão só de ícone, foco visível, contraste adequado nos dois temas.




---




## Como não desperdiçar crédito depois




- **Junte as correções.** Em vez de três mensagens ("o filtro não aparece", "a cor do selo está

  errada", "faltou o estado vazio"), acumule numa lista só. Custa um crédito em vez de três.

- **Antes de pedir uma tela nova, teste a anterior.** Corrigir uma tela é barato; descobrir na

  quinta tela que a fundação estava errada é caro.

- **Não peça "melhore o visual" ou "deixe mais bonito".** É a forma mais rápida de queimar crédito:

  o resultado é imprevisível e quase sempre gera outra rodada de correção. Peça a mudança concreta

  ("o selo de status deve usar `bg-jt-success/15 text-jt-success`").

- **Se algo já está bom, diga isso no prompt seguinte** ("não altere o AppShell"). Evita que o

  Lovable refatore de graça o que já funcionava — e que você pague para desfazer.

- **Erro de build é grátis de descrever, caro de adivinhar.** Cole a mensagem de erro inteira em vez

  de dizer "deu erro".

- **Use o modo de chat/planejamento para perguntas.** Quando você só quer entender uma decisão, não

  peça edição de código junto.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a0cfe70e-8ab9-4e79-b2bf-391274e03304).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
