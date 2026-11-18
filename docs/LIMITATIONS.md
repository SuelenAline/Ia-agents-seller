# Limites e próximos passos

Este projeto é um MVP demonstrável, não uma plataforma homologada de produção.

- PostgreSQL requer daemon Docker ou instalação externa. Testes mock não comprovam concorrência/transações reais.
- Worker tem claim atômico e commit de resultado/proposta em transação. Falha abrupta deixa RUNNING pendente de reconciliação manual. Não reenvie cegamente uma operação externa de resultado desconhecido. Falhas do agente são finais e exigem nova chave para nova tentativa; retries com backoff cobrem leituras HTTP transitórias, não jobs inteiros.
- OAuth usa exclusão atômica de estado no banco, refresh single-flight dentro de um processo e tokens criptografados. Deploy de múltiplas réplicas exige lock distribuído para refresh. Não houve autenticação em uma conta Mercado Livre de teste.
- Leitura Mercado Livre retorna IDs da primeira página. Sincronização incremental, detalhes, paginação, rate limit distribuído e escopos aprovados dependem de homologação.
- Shopee real não implementada sem credenciais/contratos autorizados. Nenhum resultado mock representa uma chamada real.
- Limites de rascunho SEO (60/120) são conservadores e locais. Não se afirma conformidade com política atual de cada categoria. Publicação é bloqueada até implementar validação de atributos e políticas reais.
- Cadastro trabalha com uma variação por envio do formulário; a API aceita múltiplas. Edição de fornecedor vinculado, estoque sincronizado e atualização de produto não estão implementadas na UI.
- Histórico importa vendas e performance agregadas, não pedidos ou dados pessoais. Não importa imagens nem cria anúncios históricos. Indicadores atuais só serão preenchidos por sincronização homologada ou carga técnica autorizada.
- Estimativa de contribuição em crescimento é parcial e usa somente receita menos custo declarado e publicidade; não estima impostos, taxas e frete ausentes.
- IA pode apresentar raciocínio incorreto apesar do schema e da checagem de evidências. Revisão humana é obrigatória. Nenhum texto gerado vira publicação por conta própria.
- Segredos de desenvolvimento vêm de ambiente. Produção exige cofre de segredos, TLS, rotação, backup, retenção, monitoramento, controle granular de papéis e política de proteção de dados.
- Auditoria não é imutável contra administrador do banco. Não há retenção automática, exportação regulatória ou gerenciamento multiempresa.
