# Tutorial v3: Monorepo com Turborepo + pnpm + Microserviços em Kubernetes

Este tutorial evolui o laboratório anterior de **Turborepo + pnpm** para um cenário mais próximo de arquitetura real:

- Um único repositório Git
- Várias apps em `apps/*`
- Cada app vira um microserviço
- Cada microserviço gera uma imagem Docker separada
- Cada microserviço tem seu próprio Deployment e Service no Kubernetes
- Pacotes compartilhados ficam em `packages/*`
- O Turborepo usa `--filter` para buildar apenas o serviço necessário e suas dependências internas

---

## 1. Ideia central

Monorepo não significa monolito.

Você pode ter:

```txt
1 repositório Git
1 workspace pnpm
1 turbo.json

mas vários microserviços independentes:
- web
- api-users
- api-orders
- worker-billing
```

A regra mental é:

```txt
apps/*      = aplicações/microserviços deployáveis
packages/*  = bibliotecas internas compartilhadas
```

Exemplo:

```bash
meu-monorepo-pnpm-turbo/
├── apps/
│   ├── web/
│   ├── api-users/
│   └── api-orders/
├── packages/
│   ├── ui/
│   ├── utils/
│   └── logger/
├── infra/
│   └── k8s/
│       ├── namespace.yaml
│       ├── web.yaml
│       ├── api-users.yaml
│       └── api-orders.yaml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── pnpm-lock.yaml
```

Runtime no Kubernetes:

```txt
Deployment web
Deployment api-users
Deployment api-orders

Service web
Service api-users
Service api-orders
```

---

## 2. Pré-requisitos

Você precisa ter no Linux:

```bash
node -v
pnpm -v
docker --version
kubectl version --client
```

Se estiver usando k3s local, confira:

```bash
kubectl get nodes
```

Se estiver usando kind:

```bash
kind get clusters
```

Se estiver usando minikube:

```bash
minikube status
```

---

## 3. Estrutura esperada do monorepo

Partindo do projeto anterior:

```bash
cd ~/labs/meu-monorepo-pnpm-turbo
```

Confira:

```bash
ls
```

Você deve ter algo parecido:

```bash
apps
packages
package.json
pnpm-workspace.yaml
turbo.json
pnpm-lock.yaml
```

Se ainda não tem o pacote `@repo/utils`, crie:

```bash
mkdir -p packages/utils/src
```

```bash
cat > packages/utils/package.json <<'EOF'
{
  "name": "@repo/utils",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "lint": "echo lint utils ok"
  },
  "devDependencies": {
    "typescript": "latest"
  }
}
EOF
```

```bash
cat > packages/utils/src/index.ts <<'EOF'
export function formatName(name: string): string {
  return name.trim().toUpperCase();
}
EOF
```

```bash
cat > packages/utils/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
EOF
```

Instale dependências:

```bash
pnpm install
```

---

## 4. Criar microserviço `api-users`

Crie a estrutura:

```bash
mkdir -p apps/api-users/src
```

Crie o `package.json`:

```bash
cat > apps/api-users/package.json <<'EOF'
{
  "name": "api-users",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "lint": "echo lint api-users ok"
  },
  "dependencies": {
    "@repo/utils": "workspace:*",
    "fastify": "^5.0.0"
  },
  "devDependencies": {
    "tsx": "latest",
    "typescript": "latest",
    "@types/node": "latest"
  }
}
EOF
```

Crie o `tsconfig.json`:

```bash
cat > apps/api-users/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
EOF
```

Crie o código:

```bash
cat > apps/api-users/src/index.ts <<'EOF'
import Fastify from "fastify";
import { formatName } from "@repo/utils";

const app = Fastify({
  logger: true
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "api-users"
  };
});

app.get("/users/:name", async (request) => {
  const params = request.params as { name: string };

  return {
    service: "api-users",
    originalName: params.name,
    formattedName: formatName(params.name)
  };
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
EOF
```

---

## 5. Criar microserviço `api-orders`

Crie a estrutura:

```bash
mkdir -p apps/api-orders/src
```

Crie o `package.json`:

```bash
cat > apps/api-orders/package.json <<'EOF'
{
  "name": "api-orders",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "lint": "echo lint api-orders ok"
  },
  "dependencies": {
    "@repo/utils": "workspace:*",
    "fastify": "^5.0.0"
  },
  "devDependencies": {
    "tsx": "latest",
    "typescript": "latest",
    "@types/node": "latest"
  }
}
EOF
```

Crie o `tsconfig.json`:

```bash
cat > apps/api-orders/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
EOF
```

Crie o código:

```bash
cat > apps/api-orders/src/index.ts <<'EOF'
import Fastify from "fastify";

const app = Fastify({
  logger: true
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "api-orders"
  };
});

app.get("/orders/:id", async (request) => {
  const params = request.params as { id: string };

  return {
    service: "api-orders",
    orderId: params.id,
    status: "created"
  };
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
EOF
```

---

## 6. Instalar dependências do workspace

Na raiz:

```bash
pnpm install
```

Teste os builds isolados:

```bash
pnpm --filter @repo/utils build
pnpm --filter api-users build
pnpm --filter api-orders build
```

Teste com Turbo:

```bash
turbo run build --filter=api-users...
turbo run build --filter=api-orders...
```

O `...` é importante.

Ele significa:

```txt
buildar o app selecionado + dependências internas necessárias
```

Exemplo:

```bash
turbo run build --filter=api-users...
```

pode envolver:

```txt
@repo/utils
api-users
```

---

## 7. Ajustar `turbo.json`

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
    "lint": {},
    "test": {}
  }
}
EOF
```

---

## 8. Rodar microserviços localmente sem Docker

Terminal 1:

```bash
pnpm --filter api-users dev
```

Terminal 2:

```bash
PORT=3001 pnpm --filter api-orders dev
```

Teste:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/users/juliano

curl http://localhost:3001/health
curl http://localhost:3001/orders/123
```

---

## 9. Dockerfile para `api-users`

Crie:

```bash
cat > apps/api-users/Dockerfile <<'EOF'
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api-users/package.json apps/api-users/package.json
COPY packages/utils/package.json packages/utils/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api-users apps/api-users
COPY packages/utils packages/utils
RUN pnpm --filter api-users build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/apps/api-users/package.json ./apps/api-users/package.json
COPY --from=build /app/apps/api-users/dist ./apps/api-users/dist
COPY --from=build /app/packages/utils ./packages/utils

RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD ["node", "apps/api-users/dist/index.js"]
EOF
```

---

## 10. Dockerfile para `api-orders`

Crie:

```bash
cat > apps/api-orders/Dockerfile <<'EOF'
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api-orders/package.json apps/api-orders/package.json
COPY packages/utils/package.json packages/utils/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api-orders apps/api-orders
COPY packages/utils packages/utils
RUN pnpm --filter api-orders build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/apps/api-orders/package.json ./apps/api-orders/package.json
COPY --from=build /app/apps/api-orders/dist ./apps/api-orders/dist
COPY --from=build /app/packages/utils ./packages/utils

RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD ["node", "apps/api-orders/dist/index.js"]
EOF
```

---

## 11. Criar `.dockerignore`

Na raiz:

```bash
cat > .dockerignore <<'EOF'
node_modules
.pnpm-store
.turbo
.git
.github
dist
build
.next
out
.env
.env.local
.vercel
README.md
EOF
```

---

## 12. Build das imagens Docker

Na raiz do monorepo:

```bash
docker build -f apps/api-users/Dockerfile -t api-users:local .
docker build -f apps/api-orders/Dockerfile -t api-orders:local .
```

Teste localmente com Docker:

```bash
docker run --rm -p 3000:3000 api-users:local
```

Em outro terminal:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/users/juliano
```

Pare o container e teste o outro:

```bash
docker run --rm -p 3001:3000 api-orders:local
```

Em outro terminal:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/orders/123
```

---

## 13. Observação sobre Docker e Turborepo

Em monorepos grandes, o ideal é otimizar o Dockerfile usando:

```bash
turbo prune api-users --docker
```

A ideia do `turbo prune` é gerar um monorepo reduzido contendo apenas o app alvo e os pacotes internos necessários.

Para o laboratório, começamos com Dockerfiles mais explícitos e didáticos.

Depois você pode evoluir para `turbo prune`.

---

## 14. Preparar Kubernetes

Crie a pasta de infraestrutura:

```bash
mkdir -p infra/k8s
```

Crie o namespace:

```bash
cat > infra/k8s/namespace.yaml <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: monorepo-demo
EOF
```

Aplique:

```bash
kubectl apply -f infra/k8s/namespace.yaml
```

---

## 15. Deploy `api-users` no Kubernetes

Crie o manifesto:

```bash
cat > infra/k8s/api-users.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-users
  namespace: monorepo-demo
  labels:
    app: api-users
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-users
  template:
    metadata:
      labels:
        app: api-users
    spec:
      containers:
        - name: api-users
          image: api-users:local
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: api-users
  namespace: monorepo-demo
spec:
  type: ClusterIP
  selector:
    app: api-users
  ports:
    - name: http
      port: 80
      targetPort: 3000
EOF
```

---

## 16. Deploy `api-orders` no Kubernetes

Crie o manifesto:

```bash
cat > infra/k8s/api-orders.yaml <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-orders
  namespace: monorepo-demo
  labels:
    app: api-orders
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-orders
  template:
    metadata:
      labels:
        app: api-orders
    spec:
      containers:
        - name: api-orders
          image: api-orders:local
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
          env:
            - name: PORT
              value: "3000"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: api-orders
  namespace: monorepo-demo
spec:
  type: ClusterIP
  selector:
    app: api-orders
  ports:
    - name: http
      port: 80
      targetPort: 3000
EOF
```

---

## 17. Aplicar manifests

```bash
kubectl apply -f infra/k8s/api-users.yaml
kubectl apply -f infra/k8s/api-orders.yaml
```

Verifique:

```bash
kubectl get pods -n monorepo-demo
kubectl get svc -n monorepo-demo
kubectl get deploy -n monorepo-demo
```

---

## 18. Importante: imagens locais e Kubernetes

Se você usa Docker local, o Kubernetes pode ou não enxergar as imagens `api-users:local` e `api-orders:local`.

Depende do ambiente:

| Ambiente | Imagem local funciona direto? |
|---|---|
| Docker Desktop Kubernetes | geralmente sim |
| kind | precisa carregar imagem com `kind load docker-image` |
| minikube | precisa buildar dentro do Docker do minikube ou carregar imagem |
| k3s em outro host | precisa de registry ou importar imagem |
| k3s no mesmo host | pode precisar de `ctr images import` ou registry local |

---

## 19. Usando kind

Se estiver usando kind:

```bash
kind load docker-image api-users:local
kind load docker-image api-orders:local
```

Depois:

```bash
kubectl rollout restart deployment/api-users -n monorepo-demo
kubectl rollout restart deployment/api-orders -n monorepo-demo
```

---

## 20. Usando minikube

Opção 1: usar Docker daemon do minikube:

```bash
eval $(minikube docker-env)

docker build -f apps/api-users/Dockerfile -t api-users:local .
docker build -f apps/api-orders/Dockerfile -t api-orders:local .
```

Depois aplique os manifests:

```bash
kubectl apply -f infra/k8s/
```

---

## 21. Usando k3s local

Para k3s, uma abordagem simples é salvar e importar a imagem:

```bash
docker save api-users:local -o api-users.tar
docker save api-orders:local -o api-orders.tar
```

Importe no containerd do k3s:

```bash
sudo k3s ctr images import api-users.tar
sudo k3s ctr images import api-orders.tar
```

Depois:

```bash
kubectl rollout restart deployment/api-users -n monorepo-demo
kubectl rollout restart deployment/api-orders -n monorepo-demo
```

Outra opção melhor para laboratório contínuo é usar um registry local.

---

## 22. Criar registry local simples

Suba um registry local:

```bash
docker run -d \
  --restart=always \
  --name registry \
  -p 5000:5000 \
  registry:2
```

Tagueie as imagens:

```bash
docker tag api-users:local localhost:5000/api-users:local
docker tag api-orders:local localhost:5000/api-orders:local
```

Push:

```bash
docker push localhost:5000/api-users:local
docker push localhost:5000/api-orders:local
```

Ajuste os manifests para usar:

```yaml
image: localhost:5000/api-users:local
```

e:

```yaml
image: localhost:5000/api-orders:local
```

Em clusters remotos, use um registry acessível pelo cluster, por exemplo:

```txt
ghcr.io/seu-usuario/api-users:sha
ghcr.io/seu-usuario/api-orders:sha
```

---

## 23. Testar serviços no Kubernetes

Como os Services são `ClusterIP`, teste com port-forward.

Terminal 1:

```bash
kubectl port-forward svc/api-users 8080:80 -n monorepo-demo
```

Em outro terminal:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/users/juliano
```

Terminal 2:

```bash
kubectl port-forward svc/api-orders 8081:80 -n monorepo-demo
```

Em outro terminal:

```bash
curl http://localhost:8081/health
curl http://localhost:8081/orders/123
```

---

## 24. Transformar `web` em frontend chamando microserviços

No Kubernetes, o frontend não deveria chamar `localhost` para acessar APIs.

Dentro do cluster, ele pode chamar:

```txt
http://api-users.monorepo-demo.svc.cluster.local
http://api-orders.monorepo-demo.svc.cluster.local
```

Ou simplesmente, se estiver no mesmo namespace:

```txt
http://api-users
http://api-orders
```

Em produção, normalmente você coloca um Ingress/API Gateway na frente.

---

## 25. Exemplo de Ingress

Se seu cluster tiver Ingress Controller, como nginx-ingress ou Traefik, crie:

```bash
cat > infra/k8s/ingress.yaml <<'EOF'
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: monorepo-demo
  namespace: monorepo-demo
spec:
  rules:
    - host: monorepo.local
      http:
        paths:
          - path: /users
            pathType: Prefix
            backend:
              service:
                name: api-users
                port:
                  number: 80
          - path: /orders
            pathType: Prefix
            backend:
              service:
                name: api-orders
                port:
                  number: 80
EOF
```

Aplique:

```bash
kubectl apply -f infra/k8s/ingress.yaml
```

Se for testar localmente, adicione no `/etc/hosts`:

```bash
sudo sh -c 'echo "127.0.0.1 monorepo.local" >> /etc/hosts'
```

A forma exata de acessar depende do seu Ingress Controller.

No k3s, frequentemente o Traefik já vem instalado.

---

## 26. Build e deploy apenas de um microserviço

Aqui entra a principal utilidade do Turborepo em microserviços.

### Build apenas de `api-users`

```bash
turbo run build --filter=api-users...
```

Build da imagem:

```bash
docker build -f apps/api-users/Dockerfile -t api-users:local .
```

Atualização no Kubernetes:

```bash
kubectl rollout restart deployment/api-users -n monorepo-demo
```

### Build apenas de `api-orders`

```bash
turbo run build --filter=api-orders...
```

Build da imagem:

```bash
docker build -f apps/api-orders/Dockerfile -t api-orders:local .
```

Atualização no Kubernetes:

```bash
kubectl rollout restart deployment/api-orders -n monorepo-demo
```

---

## 27. Script para buildar um serviço específico

Crie:

```bash
mkdir -p scripts
```

```bash
cat > scripts/build-service.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:-}"

if [ -z "$SERVICE" ]; then
  echo "Uso: ./scripts/build-service.sh <nome-do-servico>"
  echo "Exemplo: ./scripts/build-service.sh api-users"
  exit 1
fi

echo "Buildando serviço: $SERVICE"

turbo run build --filter="${SERVICE}..."

docker build \
  -f "apps/${SERVICE}/Dockerfile" \
  -t "${SERVICE}:local" \
  .

echo "Imagem criada: ${SERVICE}:local"
EOF
```

Dê permissão:

```bash
chmod +x scripts/build-service.sh
```

Use:

```bash
./scripts/build-service.sh api-users
./scripts/build-service.sh api-orders
```

---

## 28. Script para deploy local no Kubernetes

Crie:

```bash
cat > scripts/deploy-service-local.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:-}"
NAMESPACE="${2:-monorepo-demo}"

if [ -z "$SERVICE" ]; then
  echo "Uso: ./scripts/deploy-service-local.sh <nome-do-servico> [namespace]"
  echo "Exemplo: ./scripts/deploy-service-local.sh api-users monorepo-demo"
  exit 1
fi

echo "Aplicando manifest do serviço: $SERVICE"

kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f "infra/k8s/${SERVICE}.yaml"

echo "Reiniciando deployment: $SERVICE"

kubectl rollout restart "deployment/${SERVICE}" -n "$NAMESPACE"
kubectl rollout status "deployment/${SERVICE}" -n "$NAMESPACE"

echo "Deploy concluído: $SERVICE"
EOF
```

Permissão:

```bash
chmod +x scripts/deploy-service-local.sh
```

Use:

```bash
./scripts/deploy-service-local.sh api-users
./scripts/deploy-service-local.sh api-orders
```

---

## 29. Workflow mental

Para alterar apenas `api-users`:

```bash
# altera código em apps/api-users ou packages/utils

pnpm install
turbo run build --filter=api-users...

docker build -f apps/api-users/Dockerfile -t api-users:local .

# se for kind
kind load docker-image api-users:local

# se for k3s
docker save api-users:local -o api-users.tar
sudo k3s ctr images import api-users.tar

kubectl rollout restart deployment/api-users -n monorepo-demo
kubectl rollout status deployment/api-users -n monorepo-demo
```

Para alterar apenas `api-orders`:

```bash
turbo run build --filter=api-orders...
docker build -f apps/api-orders/Dockerfile -t api-orders:local .
kubectl rollout restart deployment/api-orders -n monorepo-demo
```

---

## 30. GitHub Actions: CI por microserviço

Crie um workflow específico para build de imagens por microserviço:

```bash
cat > .github/workflows/microservices-ci.yml <<'EOF'
name: Microservices CI

on:
  push:
    branches:
      - main
    paths:
      - "apps/**"
      - "packages/**"
      - "package.json"
      - "pnpm-lock.yaml"
      - "pnpm-workspace.yaml"
      - "turbo.json"
      - ".github/workflows/microservices-ci.yml"
  pull_request:
    paths:
      - "apps/**"
      - "packages/**"
      - "package.json"
      - "pnpm-lock.yaml"
      - "pnpm-workspace.yaml"
      - "turbo.json"

permissions:
  contents: read
  packages: write

jobs:
  detect-changes:
    name: Detect changed services
    runs-on: ubuntu-latest

    outputs:
      api_users: ${{ steps.filter.outputs.api_users }}
      api_orders: ${{ steps.filter.outputs.api_orders }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Detect changed paths
        id: filter
        uses: dorny/paths-filter@v3
        with:
          filters: |
            api_users:
              - 'apps/api-users/**'
              - 'packages/**'
              - 'package.json'
              - 'pnpm-lock.yaml'
              - 'pnpm-workspace.yaml'
              - 'turbo.json'
            api_orders:
              - 'apps/api-orders/**'
              - 'packages/**'
              - 'package.json'
              - 'pnpm-lock.yaml'
              - 'pnpm-workspace.yaml'
              - 'turbo.json'

  build-api-users:
    name: Build api-users
    runs-on: ubuntu-latest
    needs: detect-changes
    if: needs.detect-changes.outputs.api_users == 'true'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm from packageManager
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build api-users and dependencies
        run: turbo run build --filter=api-users...

      - name: Build Docker image
        run: docker build -f apps/api-users/Dockerfile -t api-users:${{ github.sha }} .

  build-api-orders:
    name: Build api-orders
    runs-on: ubuntu-latest
    needs: detect-changes
    if: needs.detect-changes.outputs.api_orders == 'true'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm from packageManager
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build api-orders and dependencies
        run: turbo run build --filter=api-orders...

      - name: Build Docker image
        run: docker build -f apps/api-orders/Dockerfile -t api-orders:${{ github.sha }} .
EOF
```

Esse workflow ainda não faz push para registry. Ele só valida e builda as imagens.

---

## 31. GitHub Actions com push para GHCR

Para publicar imagens no GitHub Container Registry, use nomes assim:

```txt
ghcr.io/SEU_USUARIO/api-users:sha
ghcr.io/SEU_USUARIO/api-orders:sha
```

Exemplo de job para `api-users`:

```yaml
  publish-api-users:
    name: Publish api-users
    runs-on: ubuntu-latest

    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm from packageManager
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build app
        run: turbo run build --filter=api-users...

      - name: Login to GHCR
        run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u "${{ github.actor }}" --password-stdin

      - name: Build image
        run: docker build -f apps/api-users/Dockerfile -t ghcr.io/${{ github.repository_owner }}/api-users:${{ github.sha }} .

      - name: Push image
        run: docker push ghcr.io/${{ github.repository_owner }}/api-users:${{ github.sha }}
```

Depois, no Kubernetes, você usa:

```yaml
image: ghcr.io/SEU_USUARIO/api-users:COMMIT_SHA
```

---

## 32. Deploy real no Kubernetes via CI/CD

Para deploy real via GitHub Actions, você precisa configurar acesso ao cluster.

Opções comuns:

1. `KUBECONFIG` como secret do GitHub
2. Deploy via Argo CD
3. Deploy via FluxCD
4. Pipeline publica imagem e atualiza manifest GitOps
5. Pipeline chama um runner self-hosted dentro da sua rede

Para laboratório local, eu recomendo:

```txt
GitHub Actions:
- valida
- builda
- gera imagem
- publica no GHCR

Seu cluster:
- puxa imagem do GHCR
- deploy manual com kubectl
```

Depois evolua para GitOps.

---

## 33. Manifests com imagem versionada

Em produção, evite:

```yaml
image: api-users:local
```

Use:

```yaml
image: ghcr.io/seu-usuario/api-users:1.0.0
```

ou:

```yaml
image: ghcr.io/seu-usuario/api-users:COMMIT_SHA
```

Exemplo:

```bash
kubectl set image deployment/api-users \
  api-users=ghcr.io/seu-usuario/api-users:abc123 \
  -n monorepo-demo
```

---

## 34. Comunicação entre microserviços

Dentro do Kubernetes, `api-orders` pode chamar `api-users` usando o DNS interno:

```txt
http://api-users.monorepo-demo.svc.cluster.local
```

ou, se estiver no mesmo namespace:

```txt
http://api-users
```

Exemplo em Node.js:

```ts
const response = await fetch("http://api-users/health");
const data = await response.json();
```

Atenção:

```txt
localhost dentro de um container aponta para o próprio container,
não para outro serviço.
```

---

## 35. Adicionar variáveis de ambiente

Exemplo no manifest:

```yaml
env:
  - name: PORT
    value: "3000"
  - name: API_USERS_URL
    value: "http://api-users"
```

Para valores sensíveis, use Secret:

```bash
kubectl create secret generic api-secrets \
  --from-literal=DATABASE_URL='postgres://user:pass@host:5432/db' \
  -n monorepo-demo
```

Usando no Deployment:

```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: api-secrets
        key: DATABASE_URL
```

---

## 36. Recursos mínimos por microserviço

Exemplo:

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```

Adicione dentro do container:

```yaml
containers:
  - name: api-users
    image: api-users:local
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
```

---

## 37. Escalar microserviço

```bash
kubectl scale deployment/api-users --replicas=3 -n monorepo-demo
```

Verifique:

```bash
kubectl get pods -n monorepo-demo -l app=api-users
```

---

## 38. Logs

```bash
kubectl logs -n monorepo-demo deployment/api-users
kubectl logs -n monorepo-demo deployment/api-orders
```

Seguir logs:

```bash
kubectl logs -f -n monorepo-demo deployment/api-users
```

---

## 39. Debug

Ver pods:

```bash
kubectl get pods -n monorepo-demo
```

Descrever pod:

```bash
kubectl describe pod NOME_DO_POD -n monorepo-demo
```

Ver eventos:

```bash
kubectl get events -n monorepo-demo --sort-by=.metadata.creationTimestamp
```

Entrar no pod:

```bash
kubectl exec -it deployment/api-users -n monorepo-demo -- sh
```

Testar DNS dentro do cluster:

```bash
kubectl run curl-test \
  --rm -it \
  --image=curlimages/curl \
  -n monorepo-demo \
  -- sh
```

Dentro do pod temporário:

```bash
curl http://api-users/health
curl http://api-orders/health
```

---

## 40. Limpeza

Remover recursos:

```bash
kubectl delete namespace monorepo-demo
```

Remover imagens locais:

```bash
docker rmi api-users:local api-orders:local
```

Remover registry local:

```bash
docker rm -f registry
```

---

## 41. Resumo final

O Turborepo ajuda no ciclo de build:

```bash
turbo run build --filter=api-users...
```

O Docker empacota cada app:

```bash
docker build -f apps/api-users/Dockerfile -t api-users:local .
```

O Kubernetes executa cada app como microserviço:

```bash
kubectl apply -f infra/k8s/api-users.yaml
```

A arquitetura fica assim:

```txt
Monorepo Git
  ├── apps/web
  ├── apps/api-users
  ├── apps/api-orders
  └── packages/utils

CI/CD
  ├── detecta mudança
  ├── builda somente o serviço afetado
  ├── cria imagem Docker
  └── publica/deploya

Kubernetes
  ├── Deployment api-users
  ├── Deployment api-orders
  └── Service por microserviço
```

---

## 42. Checklist

- [ ] `pnpm install` roda na raiz
- [ ] `pnpm --filter api-users build` funciona
- [ ] `pnpm --filter api-orders build` funciona
- [ ] `turbo run build --filter=api-users...` funciona
- [ ] `turbo run build --filter=api-orders...` funciona
- [ ] `docker build -f apps/api-users/Dockerfile -t api-users:local .` funciona
- [ ] `docker build -f apps/api-orders/Dockerfile -t api-orders:local .` funciona
- [ ] `kubectl apply -f infra/k8s/namespace.yaml` funciona
- [ ] `kubectl apply -f infra/k8s/api-users.yaml` funciona
- [ ] `kubectl apply -f infra/k8s/api-orders.yaml` funciona
- [ ] `kubectl port-forward svc/api-users 8080:80 -n monorepo-demo` funciona
- [ ] `curl http://localhost:8080/health` responde
- [ ] `kubectl port-forward svc/api-orders 8081:80 -n monorepo-demo` funciona
- [ ] `curl http://localhost:8081/health` responde

---

## 43. Próximos passos

Depois deste tutorial, os próximos estudos recomendados são:

1. `turbo prune --docker`
2. Docker multi-stage otimizado
3. GitHub Container Registry
4. Helm Charts
5. Kustomize
6. Argo CD
7. FluxCD
8. Ingress Controller
9. Cert-manager
10. Observabilidade com Prometheus e Grafana
11. Logs centralizados com Loki
12. Tracing com OpenTelemetry
13. Service mesh com Linkerd ou Istio

