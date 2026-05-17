# Tutorial: Monorepo com Turborepo + pnpm no Linux

Este tutorial cria um laboratório prático para estudar **monorepo** usando:

- Linux
- Git
- GitHub
- Node.js
- pnpm
- Turborepo
- Vite + React + TypeScript
- Pacotes compartilhados internos
- GitHub Actions
- Deploy futuro na Vercel

A estrutura final será parecida com esta:

```bash
meu-monorepo-pnpm-turbo/
├── apps/
│   └── web/
├── packages/
│   └── ui/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## 1. Conceitos rápidos

Um **monorepo** é um único repositório Git que contém múltiplos projetos relacionados.

Exemplo:

```bash
apps/web        # aplicação frontend
packages/ui    # biblioteca compartilhada
packages/utils # outra biblioteca compartilhada
```

A função de cada ferramenta:

| Ferramenta | Papel |
|---|---|
| pnpm | Gerencia dependências e workspaces |
| Turborepo | Orquestra builds, dev, lint, cache e dependências entre pacotes |
| GitHub | Hospeda o código |
| Vercel | Pode fazer deploy das aplicações |
| Vite | Cria a aplicação frontend React |
| TypeScript | Tipagem estática |

---

## 2. Instalar pré-requisitos no Linux

Atualize o sistema e instale ferramentas básicas:

```bash
sudo apt update
sudo apt install -y curl git build-essential
```

Verifique se já tem Node.js:

```bash
node -v
npm -v
```

Se não tiver Node.js, ou se quiser usar uma versão LTS, instale via `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

nvm install --lts
nvm use --lts

node -v
npm -v
```

Habilite o `pnpm` com Corepack:

```bash
corepack enable
corepack prepare pnpm@latest --activate

pnpm -v
```

Instale o Turborepo globalmente, opcionalmente:

```bash
pnpm add turbo --global
turbo --version
```

---

## 3. Criar pasta de laboratório

```bash
mkdir -p ~/labs
cd ~/labs
```

Crie o projeto manualmente:

```bash
mkdir meu-monorepo-pnpm-turbo
cd meu-monorepo-pnpm-turbo
git init
```

Crie a estrutura inicial:

```bash
mkdir -p apps/web packages/ui
```

---

## 4. Criar `pnpm-workspace.yaml`

Na raiz do projeto:

```bash
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF
```

Esse arquivo diz ao pnpm que tudo dentro de `apps/*` e `packages/*` faz parte do mesmo workspace.

---

## 5. Criar `package.json` da raiz

Na raiz:

```bash
cat > package.json <<'EOF'
{
  "name": "meu-monorepo-pnpm-turbo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  },
  "devDependencies": {}
}
EOF
```

Agora instale `turbo` e `typescript` na raiz do workspace.

Importante: como estamos na raiz do monorepo, use `-w`.

```bash
pnpm add -D turbo typescript -w
```

O `-w` significa **workspace root**.

Sem ele, você pode receber este erro:

```bash
ERR_PNPM_ADDING_TO_ROOT
```

Isso é normal. O pnpm só quer confirmar que você realmente quer instalar a dependência na raiz.

---

## 6. Corrigir o campo `packageManager`

O Turborepo exige que o campo `packageManager` tenha uma versão fixa.

Não use:

```json
"packageManager": "pnpm@latest"
```

Use a versão real instalada.

Rode:

```bash
npm pkg set packageManager="pnpm@$(pnpm -v)"
```

Confira:

```bash
cat package.json
```

Você deve ver algo parecido com:

```json
{
  "name": "meu-monorepo-pnpm-turbo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "...",
    "typescript": "..."
  },
  "packageManager": "pnpm@10.23.0"
}
```

A versão pode ser diferente no seu ambiente.

---

## 7. Criar `turbo.json`

Na raiz:

```bash
cat > turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {}
  }
}
EOF
```

Explicação:

| Configuração | Significado |
|---|---|
| `build` | tarefa de build |
| `dependsOn: ["^build"]` | antes de buildar um app, builda os pacotes internos dos quais ele depende |
| `outputs` | pastas geradas pelo build |
| `dev.cache: false` | não faz cache do modo desenvolvimento |
| `dev.persistent: true` | indica processo contínuo, como servidor dev |

---

## 8. Criar o pacote compartilhado `@repo/ui`

Entre no pacote:

```bash
cd packages/ui
```

Se você tentar rodar:

```bash
pnpm init
```

e receber:

```bash
ERR_PNPM_PACKAGE_JSON_EXISTS package.json already exists
```

não tem problema. Isso significa apenas que o arquivo já existe.

Vamos substituir o conteúdo do `package.json`:

```bash
cat > package.json <<'EOF'
{
  "name": "@repo/ui",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "echo lint ui ok"
  },
  "devDependencies": {
    "typescript": "latest"
  }
}
EOF
```

Crie o código do pacote:

```bash
mkdir -p src

cat > src/index.ts <<'EOF'
export function Button(label: string): string {
  return `Botão compartilhado: ${label}`;
}
EOF
```

Crie o `tsconfig.json` do pacote:

```bash
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
EOF
```

Volte para a raiz:

```bash
cd ../..
```

Confirme:

```bash
pwd
```

O resultado esperado deve ser algo como:

```bash
/root/labs/meu-monorepo-pnpm-turbo
```

---

## 9. Criar a aplicação `apps/web` com Vite

Entre na pasta do app:

```bash
cd apps/web
```

Crie o app Vite React TypeScript dentro da pasta atual:

```bash
pnpm create vite . --template react-ts
```

Se ele perguntar se pode criar na pasta atual, confirme.

Volte para a raiz:

```bash
cd ../..
```

Instale as dependências:

```bash
pnpm install
```

---

## 10. Adicionar `@repo/ui` como dependência do app `web`

Na raiz:

```bash
pnpm --filter web add @repo/ui@workspace:*
```

O `workspace:*` força o pnpm a usar o pacote local do monorepo, em vez de tentar baixar algo do registry público.

Confira o `apps/web/package.json`:

```bash
cat apps/web/package.json
```

Você deve ver algo assim:

```json
"dependencies": {
  "@repo/ui": "workspace:*",
  ...
}
```

---

## 11. Substituir o `App.tsx`

O Vite já cria um `apps/web/src/App.tsx` com conteúdo inicial.

Para este laboratório, substitua o arquivo inteiro:

```bash
cat > apps/web/src/App.tsx <<'EOF'
import { Button } from "@repo/ui";
import "./App.css";

function App() {
  return (
    <>
      <h1>Monorepo com Turborepo + pnpm</h1>
      <p>{Button("Clique aqui")}</p>
    </>
  );
}

export default App;
EOF
```

Este é o ponto mais importante do exercício:

```tsx
import { Button } from "@repo/ui";
```

Aqui o app `apps/web` está importando código do pacote compartilhado `packages/ui`.

---

## 12. Rodar o projeto

Na raiz:

```bash
pnpm dev
```

Ou diretamente com Turbo:

```bash
turbo run dev
```

Para rodar somente o app `web`:

```bash
turbo run dev --filter=web
```

Se tudo estiver correto, o Vite deve mostrar uma URL parecida com:

```bash
http://localhost:5173/
```

Se estiver acessando de outra máquina na rede, rode:

```bash
pnpm --filter web dev -- --host 0.0.0.0
```

ou ajuste o script `dev` do `apps/web/package.json`.

---

## 13. Testar build

Na raiz:

```bash
pnpm build
```

Ou:

```bash
turbo run build
```

O Turbo deve executar os builds respeitando as dependências internas.

Exemplo lógico:

```bash
packages/ui build
apps/web build
```

A regra responsável por isso é:

```json
"dependsOn": ["^build"]
```

---

## 14. Criar `.gitignore`

Na raiz do projeto:

```bash
cat > .gitignore <<'EOF'
# dependencies
node_modules
.pnpm-store

# turbo
.turbo

# build outputs
dist
build
.next
out

# environment
.env
.env.local
.env.*.local

# logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*

# editor / OS
.DS_Store
.vscode
.idea

# vercel
.vercel
EOF
```

Confira:

```bash
cat .gitignore
```

---

## 15. Se você já commitou o que não deveria

O `.gitignore` não remove do GitHub arquivos que já foram commitados.

Ele só impede que novos arquivos ignorados sejam adicionados.

Para remover arquivos do GitHub sem apagar da sua máquina, use `git rm --cached`.

Exemplo:

```bash
git rm -r --cached node_modules .turbo dist build .next out .vercel 2>/dev/null || true
git rm --cached .env .env.local 2>/dev/null || true
```

Depois:

```bash
git status
```

Você pode ver algo como:

```bash
deleted: node_modules/...
modified: .gitignore
```

Isso significa que será deletado do repositório Git, mas não necessariamente da sua máquina.

Faça commit e push:

```bash
git add .gitignore
git commit -m "remove ignored files from repository"
git push
```

### Método mais amplo

Se você não sabe exatamente o que já foi commitado errado:

```bash
git rm -r --cached .
git add .
git commit -m "apply gitignore and remove tracked generated files"
git push
```

Esse comando limpa o índice Git e adiciona novamente apenas o que não está ignorado.

---

## 16. Primeiro commit

Configure sua identidade Git, se necessário:

```bash
git config --global user.name "Juliano Souza"
git config --global user.email "juliano641@gmail.com"
```

Veja o status:

```bash
git status
```

Faça o commit:

```bash
git add .
git commit -m "initial monorepo with pnpm and turborepo"
```

---

## 17. Subir para o GitHub

Crie um repositório vazio no GitHub, por exemplo:

```bash
meu-monorepo-pnpm-turbo
```

Depois conecte seu repositório local.

### Usando HTTPS

```bash
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/meu-monorepo-pnpm-turbo.git
git push -u origin main
```

### Usando SSH

```bash
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/meu-monorepo-pnpm-turbo.git
git push -u origin main
```

Troque `SEU_USUARIO` pelo seu usuário do GitHub.

Se o remote já existir:

```bash
git remote -v
```

Para alterar:

```bash
git remote set-url origin https://github.com/SEU_USUARIO/meu-monorepo-pnpm-turbo.git
```

---

## 18. Criar GitHub Actions para CI

Crie o diretório:

```bash
mkdir -p .github/workflows
```

Crie o workflow:

```bash
cat > .github/workflows/ci.yml <<'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build
EOF
```

Commit:

```bash
git add .github/workflows/ci.yml
git commit -m "add github actions ci"
git push
```

---

## 19. Relação entre pnpm, Turborepo, GitHub e Vercel

O pnpm não faz deploy sozinho.

A relação é:

```bash
GitHub
  ↓ push
Vercel
  ↓ detecta o projeto
pnpm install
  ↓ instala dependências do monorepo
turbo build
  ↓ builda somente o necessário
deploy
```

Papel de cada um:

| Ferramenta | Função |
|---|---|
| pnpm | Instala dependências e gerencia workspaces |
| Turborepo | Decide a ordem e o escopo de build |
| GitHub | Guarda o código |
| Vercel | Faz build e deploy |

Em um monorepo, normalmente você configura um projeto Vercel por app.

Exemplo:

```bash
apps/web
apps/docs
```

Na Vercel:

```bash
Root Directory: apps/web
Build Command: pnpm build
```

ou:

```bash
Build Command: turbo build
```

Arquivos importantes que precisam estar no GitHub:

```bash
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
turbo.json
apps/web/package.json
packages/ui/package.json
```

Arquivos que não devem subir:

```bash
node_modules/
.turbo/
.next/
dist/
.env
.vercel/
```

---

## 20. Comandos úteis do pnpm

Instalar dependência na raiz:

```bash
pnpm add -D eslint -w
```

Instalar dependência em um app:

```bash
pnpm --filter web add axios
```

Instalar dependência em um pacote:

```bash
pnpm --filter @repo/ui add clsx
```

Rodar script em tudo:

```bash
pnpm build
```

Rodar script em um app:

```bash
pnpm --filter web dev
```

Rodar com Turbo:

```bash
turbo run build
turbo run lint
turbo run dev
```

Rodar somente o app web:

```bash
turbo run dev --filter=web
```

Ver grafo de dependências:

```bash
turbo run build --graph
```

---

## 21. Exercício extra: criar `@repo/utils`

Crie outro pacote compartilhado:

```bash
mkdir -p packages/utils/src
```

Crie o `package.json`:

```bash
cat > packages/utils/package.json <<'EOF'
{
  "name": "@repo/utils",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc --noEmit",
    "lint": "echo lint utils ok"
  },
  "devDependencies": {
    "typescript": "latest"
  }
}
EOF
```

Crie o código:

```bash
cat > packages/utils/src/index.ts <<'EOF'
export function formatName(name: string): string {
  return name.trim().toUpperCase();
}
EOF
```

Crie o `tsconfig.json`:

```bash
cat > packages/utils/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
EOF
```

Adicione ao app:

```bash
pnpm --filter web add @repo/utils@workspace:*
```

Atualize o `App.tsx`:

```bash
cat > apps/web/src/App.tsx <<'EOF'
import { Button } from "@repo/ui";
import { formatName } from "@repo/utils";
import "./App.css";

function App() {
  return (
    <>
      <h1>{formatName("Juliano")}</h1>
      <p>{Button("Entrar")}</p>
    </>
  );
}

export default App;
EOF
```

Rode:

```bash
pnpm dev
```

---

## 22. Troubleshooting

### Erro: `ERR_PNPM_ADDING_TO_ROOT`

Problema:

```bash
pnpm add -D turbo typescript
```

Solução:

```bash
pnpm add -D turbo typescript -w
```

---

### Erro: `invalid_package_manager_field`

Problema:

```json
"packageManager": "pnpm@latest"
```

Solução:

```bash
npm pkg set packageManager="pnpm@$(pnpm -v)"
```

Depois:

```bash
pnpm install
pnpm dev
```

---

### Erro: `ERR_PNPM_PACKAGE_JSON_EXISTS`

Problema:

```bash
pnpm init
```

em uma pasta onde já existe `package.json`.

Solução:

Não precisa rodar `pnpm init`. Apenas sobrescreva ou edite o arquivo existente.

---

### Erro: não encontra `@repo/ui`

Rode:

```bash
pnpm --filter web add @repo/ui@workspace:*
pnpm install
```

Depois:

```bash
pnpm dev
```

---

### Quero limpar dependências e instalar de novo

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
pnpm build
```

---

## 23. Checklist final

Antes de considerar o lab pronto, confira:

```bash
cat pnpm-workspace.yaml
cat turbo.json
cat package.json
cat apps/web/package.json
cat packages/ui/package.json
git status
pnpm install
pnpm build
pnpm dev
```

Checklist conceitual:

- [ ] Existe `pnpm-workspace.yaml`
- [ ] Existe `turbo.json`
- [ ] `package.json` da raiz tem `"private": true`
- [ ] `packageManager` usa versão fixa, por exemplo `pnpm@10.23.0`
- [ ] `apps/web` importa `@repo/ui`
- [ ] `@repo/ui` está em `packages/ui`
- [ ] Dependência interna usa `workspace:*`
- [ ] `.gitignore` existe
- [ ] `node_modules` não está no GitHub
- [ ] `pnpm-lock.yaml` está commitado
- [ ] `pnpm build` funciona
- [ ] `pnpm dev` funciona

---

## 24. Comando completo resumido

Para referência rápida:

```bash
sudo apt update
sudo apt install -y curl git build-essential

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

nvm install --lts
nvm use --lts

corepack enable
corepack prepare pnpm@latest --activate

mkdir -p ~/labs
cd ~/labs

mkdir meu-monorepo-pnpm-turbo
cd meu-monorepo-pnpm-turbo

git init
mkdir -p apps/web packages/ui

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

cat > package.json <<'EOF'
{
  "name": "meu-monorepo-pnpm-turbo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  },
  "devDependencies": {}
}
EOF

pnpm add -D turbo typescript -w
npm pkg set packageManager="pnpm@$(pnpm -v)"

cat > turbo.json <<'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {}
  }
}
EOF
```

Continue a partir das seções de criação do `packages/ui` e `apps/web`.

---

## 25. Próximos estudos recomendados

Depois deste lab, estude:

1. Cache local do Turborepo
2. Remote cache
3. Deploy na Vercel
4. Monorepo com múltiplos apps
5. Pacotes compartilhados com build real para `dist`
6. ESLint compartilhado
7. TypeScript config compartilhado
8. Testes com Vitest
9. CI/CD com GitHub Actions
10. Versionamento de pacotes com Changesets

