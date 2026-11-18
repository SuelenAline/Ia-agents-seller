# Plano de execução

1. Fundação: workspaces npm, Next.js, NestJS, configuração e Docker.
2. Dados: PostgreSQL, Prisma, catálogo com variações e fornecedores, snapshots e importação validada 2020–2024.
3. Domínio: preço determinístico, equivalência de concorrentes, SEO fundamentado e crescimento sem execução financeira.
4. Operação: jobs persistentes, propostas versionadas, aprovação humana, auditoria e kill switch.
5. Painel: dez áreas responsivas, navegação, busca, simulação, importação e revisão.
6. Integrações: mocks explícitos, OAuth ML com tokens criptografados; Shopee real bloqueada até homologação.
7. Verificação: tipos, build, Jest, integração HTTP e Playwright. Registrar resultados reais em VERIFY.md.

Critério: demonstração local funcional com dados fictícios. Publicação real e Shopee não são consideradas homologadas sem credenciais e testes de conta autorizada.

## Estado entregue

As oito fases receberam implementação do MVP e verificação local documentada em `VERIFY.md`. Banco e fluxo concorrente foram testados em PostgreSQL real. O frontend tem as dez áreas solicitadas. Há contratos OpenAPI, mock explícito, importação validada, quatro agentes e revisão humana.

Continuam fora da homologação: publicação real, integração Shopee real, validação de política por categoria, recuperação automática de jobs interrompidos, controle multiusuário e exportação OTLP a uma infraestrutura externa. Isso limita o projeto a uma fundação demonstrável, sem caracterizá-lo como operação produtiva concluída.
