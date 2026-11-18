# Verificação da implementação

Ambiente: Windows, Node.js 24.17.0, npm 11.13.0 e PostgreSQL 16 em Docker. Data local: 7 de novembro de 2026 (America/Sao_Paulo).

| Verificação                               | Resultado observado                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                            | Passou: tipos em domain, API e web                                                                                                    |
| `npm test`                                | 22 testes passaram em três suítes; quatro testes PostgreSQL ficam desabilitados sem opt-in                                            |
| `RUN_DB_TESTS=true` + suíte PostgreSQL    | Quatro testes passaram com banco real: catálogo/Decimal, idempotência concorrente/claim, decisão concorrente e importação deduplicada |
| `npm run build`                           | Passou: domain, API NestJS 11 e Next.js 16.4.5 com Webpack                                                                            |
| `npm run test:e2e`                        | Uma jornada Chromium passou: login, dashboard, preço, SEO, aprovação e viewport mobile 390×844                                        |
| `prisma generate` e `prisma validate`     | Passaram com `DATABASE_URL` configurada                                                                                               |
| `prisma migrate deploy`                   | Migration inicial aplicada em PostgreSQL local                                                                                        |
| `npm run db:seed`                         | Executado sem erro no PostgreSQL local                                                                                                |
| `docker compose config --quiet`           | Configuração aceita                                                                                                                   |
| `docker compose build`                    | Três imagens compiladas em Linux/Node 22: API, web e migration                                                                        |
| `docker compose up -d`                    | Migration/seed encerraram com sucesso; PostgreSQL saudável, API e web em execução                                                     |
| `node scripts/smoke.cjs` contra Compose   | Health MOCK, catálogo, preço R$ 62,27, schema OpenAPI, job SEO, aprovação, execução externa bloqueada e web HTTP 200                  |
| `npm audit --omit=dev --audit-level=high` | Zero vulnerabilidades de dependências de produção no lockfile verificado                                                              |

Os testes HTTP adicionais executam os quatro agentes, verificam conversão observada sem inventar visitas/vendas, separam histórico de observações atuais e recusam título longo/preço inviável. Autenticação, assinatura adulterada, criptografia autenticada, kill switch, repetição de revisão e bloqueio de execução externa também são cobertos.

Capturas geradas pelo navegador e inspecionadas visualmente: `artifacts/dashboard-desktop.png` e `artifacts/catalog-mobile.png`. A tabela de catálogo usa rolagem interna no mobile, sem overflow horizontal da página.

## Ajustes necessários durante a verificação

- Download do engine Prisma e dependências precisou de acesso à rede fora do sandbox.
- Turbopack falhou ao iniciar subprocessos no Windows, inclusive fora do sandbox. Os comandos Next foram configurados para Webpack e então passaram.
- NestJS 12 apresentou incompatibilidade ESM com a árvore de dependências do Jest; mantida a versão 11, com `multer` corrigido e versões deduplicadas.
- A auditoria completa, incluindo ferramentas de desenvolvimento, ainda aponta sete ocorrências de baixa severidade na árvore Jest/deepmerge. Não equivalem a vulnerabilidades nas dependências de runtime. O Dockerfile atual mantém ferramentas de desenvolvimento para migrations e diagnóstico; não é uma imagem mínima de produção.

## O que estes testes não comprovam

Nenhuma chamada OpenAI ou marketplace foi feita com credenciais reais. OAuth, renovação de token, escopos da conta, políticas atuais por categoria, exportação a coletor OTLP e operações Shopee reais não foram homologados. Publicação e alterações financeiras externas permanecem bloqueadas. Os testes não são certificação de segurança, carga ou operação multiempresa.

Consulte `LIMITATIONS.md` para recuperação de jobs interrompidos e restrições do MVP.

Ao final da verificação, os serviços Compose foram deixados ativos em localhost:3000 (painel), localhost:4000 (API) e localhost:5432 (PostgreSQL). O smoke test deixou uma proposta fictícia aprovada, sem publicação externa. Para parar os serviços preservando o banco, use `docker compose stop`.
