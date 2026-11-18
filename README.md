# seller-agents-ai

Plataforma de inteligência comercial para moda infantil em Mercado Livre e Shopee. MVP local com Next.js, NestJS, PostgreSQL/Prisma, contratos Zod, OpenAI Structured Outputs, fila persistente no PostgreSQL, aprovação humana e demonstração mock.

## Início rápido · mock sem serviços externos

Requisitos: Node.js 22 ou 24 e npm 10+. No diretório raiz:

```powershell
npm ci
npm run db:generate
npm run build -w packages/domain
npm run dev
```

Abra http://localhost:3000. Login demonstrativo: `admin@example.local` / `demo-seller-2026`. API: http://localhost:4000. Swagger: http://localhost:4000/docs; JSON: http://localhost:4000/docs-json.

Com o ambiente mock em execução, `node scripts/smoke.cjs` verifica os serviços, o contrato OpenAPI e o fluxo de proposta/aprovação. Esse script recusa qualquer ambiente que não declare modo MOCK.

Sem `.env`, o modo mock é padrão e não chama marketplaces nem OpenAI. Os dados mock residem em memória e reiniciam junto com a API. O painel identifica esse modo. Use as credenciais preenchidas somente na demonstração local.

## Banco e Docker

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
```

Para usar PostgreSQL na API, defina `MOCK_MODE=false`, `AUTH_SECRET` aleatório com pelo menos 32 caracteres, `ADMIN_EMAIL` e `ADMIN_PASSWORD` com pelo menos 16 caracteres. O banco deve estar acessível em `DATABASE_URL`. `npm run dev` carrega o `.env` da raiz. Chamadas de IA real exigem chave e modelo configurados; fichas SEO locais e cálculo de preços não exigem IA externa.

Para subir todo o ambiente: `docker compose up --build`. O serviço `migrate` aplica migrations e seed antes da API. No modo mock, a API continua usando memória mesmo que o Postgres esteja disponível. Configure `MOCK_MODE=false` para persistência real. As portas Docker são vinculadas apenas a localhost. `POSTGRES_PASSWORD` pode ser personalizado no `.env`, junto com `DATABASE_URL` para ferramentas locais.

## O que demonstrar

1. Entre e veja catálogo e histórico fictício explicitamente separado dos indicadores atuais.
2. Cadastre um produto e confirme a veracidade da ficha técnica. Inclua tamanho, cor, estoque, custo e piso.
3. Simule preços com custos e percentuais próprios. Frações: `0.16` equivale a 16%. A soma das taxas e margem deve ser inferior a 1.
4. Em Execuções, selecione um produto e execute SEO, concorrência, precificação ou crescimento. O worker processa a fila a cada 500 ms.
5. Atualize o painel ou aguarde a atualização de 15 s. Revise a proposta em Aprovações. Aprovar registra a decisão, sem executar ação externa.
6. Abra a proposta SEO no editor e salve uma nova versão como proposta independente.
7. Importe CSV histórico com mapeamento de colunas; valide antes de gravar. `visits` pode ficar vazio. Valores monetários usam ponto decimal e não têm símbolo de moeda.
8. Pause agentes pelo kill switch; novas execuções serão recusadas e resultados em andamento serão descartados antes de criar proposta.

## Arquitetura

```text
apps/web          Next.js App Router, TypeScript, Tailwind; dez áreas responsivas
apps/api          NestJS: autenticação, API, store, worker, IA, adapters e telemetria
packages/domain   Zod e regras puras: preço, ficha técnica, equivalência e SEO
prisma            Schema, migration SQL e seed idempotente
tests             Jest de domínio/segurança/HTTP e Playwright de jornada
docs              Plano, contratos, limites e resultados de verificação
```

Monólito com componentes de domínio separados por responsabilidade, um processo de API/worker e PostgreSQL. `Store` troca Prisma por memória em mock. Jobs têm chave idempotente única e claim atômico no banco. Criação de proposta e conclusão de job usam transação. Importações históricas no banco são atômicas e têm digest único. Valores monetários persistidos usam Decimal(12,2); a fórmula calcula com número JS e arredonda para cima ao centavo. Taxas do exemplo são fictícias e não correspondem à tabela oficial de um canal.

A versão de proposta é imutável: cada geração ou salvamento cria uma nova aprovação com seu payload. `Listing`/`ListingVersion` estão no schema para futura publicação homologada, mas não são preenchidos pelo mock como se fossem anúncios reais.

## Segurança e limites operacionais

- API autenticada por token HMAC de 1 hora, sem segredos no frontend; token em sessionStorage, limpo ao sair. MVP de administrador único configurado no servidor; não inclui cadastro, recuperação de senha ou RBAC multiusuário.
- Entrada validada com Zod, limite JSON de 2 MB, rate limit global, CORS com origem explícita e Helmet. Credenciais demo só têm fallback em mock.
- Tokens OAuth com AES-256-GCM; configure `TOKEN_ENCRYPTION_KEY` com 32 bytes em hex (64 caracteres). Não devolvemos tokens no status das integrações.
- IA recebe evidências como dados não confiáveis, sem ferramentas e com esquema JSON/Zod. IDs citados são validados; textos gerados ainda exigem revisão humana e não representam verificação factual automática completa.
- Importação ignora colunas não mapeadas e não armazena identificadores de compradores. Não envie nomes, documentos, endereços ou dados de pagamento.
- Auditoria registra operações principais. Administrador único pode revisar suas próprias propostas; segregação de funções não está implementada.
- A fila não recupera automaticamente jobs deixados em RUNNING após queda do processo. Consulte `docs/LIMITATIONS.md` antes de operação produtiva. Execute apenas uma réplica da API enquanto a renovação OAuth não usar lock distribuído.
- `ALLOW_REAL_ACTIONS` é reservado: não libera publicação. Todas as ações financeiras, publicação e alteração de publicidade reais estão bloqueadas no MVP, mesmo com aprovação.

## Integrações

Mercado Livre: fluxo OAuth com estado de uso único e prazo, troca de código, armazenamento criptografado, renovação de refresh token e leitura de IDs dos anúncios próprios. Leituras têm retries com backoff para falha de rede, 429 e erros transitórios, timeout e espaçamento local. Não se repete automaticamente uma troca de credencial rotativa com resultado ambíguo. A consulta ainda não pagina todos os anúncios nem baixa detalhes. Sem scraping.

Shopee: contrato tipado e mock. Operações reais falham explicitamente; não há endpoints ou permissões inventados.

OpenAI: Responses API com `zodTextFormat`, Structured Outputs, `store:false`, timeout e verificação dos IDs de evidência. Usada para síntese de concorrência e crescimento; SEO conservador local e preço determinístico. Sem chave/modelo não há fallback silencioso para IA real.

Referências: [Structured Outputs oficial](https://developers.openai.com/api/docs/guides/structured-outputs), [OAuth Mercado Livre](https://developers.mercadolivre.com.br/autenticacao-e-autorizacao). A documentação do ML retornou 403 ao acesso automatizado nesta implementação; o adapter não foi homologado com credenciais.

## Verificação

```powershell
npm run db:generate
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

`lint` executa verificação estática de tipos nos três workspaces; não é uma configuração ESLint. Os testes HTTP usam a aplicação Nest real com store em memória. A suíte PostgreSQL é opt-in e usa um banco local migrado:

```powershell
$env:DATABASE_URL='postgresql://seller:seller_local@localhost:5432/seller'
$env:RUN_DB_TESTS='true'
npm test -- --runTestsByPath tests/postgres.test.ts
Remove-Item Env:RUN_DB_TESTS
```

Essa suíte cria registros com identificadores próprios e remove somente os registros que criou. Testes PostgreSQL não equivalem a homologação de marketplace. Consulte [resultados e limitações](docs/VERIFY.md). O build usa Webpack explicitamente por compatibilidade com o ambiente Windows verificado.

## Observabilidade

Sem endpoint configurado, spans são no-op e não se enviam dados. Com `OTEL_EXPORTER_OTLP_ENDPOINT` configurado, NodeSDK instrumenta HTTP e jobs, enviando traces ao coletor OTLP via HTTP. Cada execução também grava resultado e auditoria no banco/store. O coletor externo não vem no Compose; configure o endpoint e a política de retenção da sua infraestrutura.
