# Contratos do MVP

Todos os endpoints abaixo, exceto `/health`, `/auth/login` e callback OAuth, exigem `Authorization: Bearer <token>`. Erros usam `{statusCode,message}`. Swagger navegável em `/docs`; os schemas de entrada são derivados dos contratos Zod. Regras contextuais, como ficha validada, piso do produto e limites por canal, também são verificadas em runtime.

| Método e rota                                | Uso                                                                         |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| POST /auth/login                             | `{email,password}` → token de administrador de 1 h                          |
| GET /dashboard                               | Indicadores atuais e históricos separados, estoque, propostas e kill switch |
| GET/POST /products                           | Catálogo e cadastro da ficha com variations                                 |
| GET/POST /suppliers                          | Fornecedores; POST recebe `{name}`                                          |
| GET /competitors                             | Snapshots com origem e captura                                              |
| POST /competitors/import                     | Array de snapshots autorizados                                              |
| GET/POST /keywords                           | Termos; POST recebe `{term,source,volume:null}`                             |
| POST /pricing/simulate                       | Custos e taxas → cálculo determinístico                                     |
| GET /listings e /listing-versions            | Anúncios reais/versões existentes; vazios até integração                    |
| POST /listings/draft                         | Proposta versionada: `{productId,channel,title,description,price}`          |
| GET /performance                             | Histórico, atual e sazonalidade                                             |
| POST /performance/observations               | Registra observação atual autorizada (2025 em diante, sem datas futuras)    |
| POST /history/import                         | CSV com mapping, delimiter e dryRun                                         |
| GET /approvals                               | Propostas e decisões                                                        |
| POST /approvals/:id/review                   | `{decision:"APPROVED" ou "REJECTED"}`                                       |
| POST /approvals/:id/execute                  | Sempre bloqueado no MVP; aprovação não publica                              |
| GET/POST /agents/runs                        | Consulta/enfileiramento de jobs                                             |
| POST /agents/kill-switch                     | `{enabled:true ou false}`                                                   |
| GET /audit                                   | Auditoria                                                                   |
| GET /integrations                            | Estado sanitizado sem tokens                                                |
| GET /integrations/ml/authorize               | URL OAuth com estado; em mock url=null                                      |
| GET /integrations/ml/callback?code=…&state=… | Troca de código após validação do estado                                    |
| GET /integrations/ml/items                   | IDs de anúncios próprios; em mock explicitamente vazio                      |
| GET /integrations/shopee/items               | Mock ou erro explícito de não homologação                                   |

## Produto

```json
{
  "sku": "CONJ-010",
  "name": "Conjunto infantil sol",
  "category": "Conjuntos infantis",
  "brand": "Pequeno Sol",
  "fabric": "Algodão",
  "pieces": 2,
  "cost": 24,
  "minimumPrice": 49.9,
  "validated": true,
  "variations": [{ "size": "2", "color": "Lavanda", "stock": 10 }]
}
```

## Snapshot

```json
[
  {
    "externalId": "authorized-001",
    "channel": "MERCADO_LIVRE",
    "name": "Conjunto infantil sol",
    "category": "Conjuntos infantis",
    "brand": "Pequeno Sol",
    "fabric": "Algodão",
    "size": "2",
    "pieces": 2,
    "price": 60,
    "shipping": 8,
    "source": "CSV autorizado pelo fornecedor, lote 001",
    "capturedAt": "2026-11-07T12:00:00.000Z",
    "sales": null
  }
]
```

`sales:null` significa indisponível. Nenhum volume é inferido. Origem é declarada pelo operador, não verificada automaticamente. Ambos os marketplaces usam enum `MERCADO_LIVRE` ou `SHOPEE`.

## Job

```json
{
  "agent": "seo",
  "productId": "p1",
  "channel": "MERCADO_LIVRE",
  "idempotencyKey": "uma-chave-unica-por-acao"
}
```

Agentes: `seo`, `pricing`, `competition`, `growth`. `p1` é apenas ID mock; no PostgreSQL use o ID retornado pelo catálogo. Repetir chave com o mesmo payload devolve a execução existente; conteúdo diferente é conflito.

## CSV histórico

Observações atuais usam `{productId,date,channel,orders,visits,price,revenue,adSpend,cost}` em `/performance/observations`. `price` e `visits` podem ser null. Custos são totais da linha; não inclua publicidade duas vezes. A contribuição do agente de crescimento é parcial quando taxas e logística não estiverem embutidas no custo declarado.

```csv
sku,date,channel,orders,visits,revenue,adSpend,cost
CONJ-001,2024-12-01,MERCADO_LIVRE,25,,1497.50,80,700
```

```json
{
  "csv": "sku,date,channel,orders,visits,revenue,adSpend,cost\nCONJ-001,2024-12-01,MERCADO_LIVRE,25,,1497.50,80,700",
  "mapping": {
    "sku": "sku",
    "date": "date",
    "channel": "channel",
    "orders": "orders",
    "visits": "visits",
    "revenue": "revenue",
    "adSpend": "adSpend",
    "cost": "cost"
  },
  "delimiter": ",",
  "dryRun": true
}
```

Datas ISO 2020–2024, SKU existente, pedidos inteiros não negativos, visitas ausentes como null. Custos são totais da linha, receita bruta e publicidade separada; defina uma linha por produto/data/canal. Chave repetida impede importação. CSV não suporta vírgula decimal: normalize os valores antes. Alterar `dryRun` para false grava o lote integral validado.
