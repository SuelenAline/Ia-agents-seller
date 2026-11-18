# Diagnóstico do 403 ao autorizar Mercado Livre

## Evidências

- A API local está configurada em modo REAL e o início local de OAuth já retornou HTTP 200. Isso comprova a construção local da URL, não a aceitação do aplicativo pelo Mercado Livre.
- O callback configurado é `http://localhost:4000/integrations/ml/callback`.
- O guia oficial de desenvolvimento in-house orienta cadastrar uma URL HTTPS e exige correspondência exata com o `redirect_uri` enviado. A orientação inicial para usar HTTP local estava incompleta.
- Requisições HTTP de diagnóstico, sem credenciais, para `https://auth.mercadolivre.com.br/` e para a página pública de autenticação da documentação retornaram status 403, com servidor CloudFront. Requisições automatizadas podem receber tratamento diferente do navegador; isso não determina a causa do erro do usuário.
- A mensagem CloudFront fornecida pelo usuário não distingue, sozinha, erro de configuração, regra WAF ou bloqueio de acesso. Não foi demonstrado que a chave secreta é inválida.

## Dados necessários para continuar

1. URI de redirecionamento exatamente cadastrada no aplicativo.
2. Navegador em que o erro ocorreu: interno ou externo.
3. Confirmar se PKCE está habilitado no aplicativo. A implementação atual não envia challenge/verifier; se habilitado, precisa ser implementado antes da autorização.

Não trocar a URI por um endereço arbitrário ou desativar controles de segurança para tentar contornar o 403. A URL HTTPS deve terminar no callback desta API, por configuração de hospedagem/proxy ou túnel explicitamente autorizado, e também estar cadastrada no aplicativo Mercado Livre.

Depois de alinhar o callback: gerar novo OAuth pelo painel, autenticar com a conta administradora, autorizar, validar o retorno e só então consultar anúncios. Não reutilizar códigos, estados ou links de tentativas anteriores.

## Referências oficiais

- [Guia in-house Mercado Livre](https://developers.mercadolivre.com.br/desenvolvimento-in-house)
- [Autenticação e autorização, incluindo PKCE opcional](https://developers.mercadolivre.com.br/autenticacao-e-autorizacao)
- [Diagnóstico de HTTP 403 CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/http-403-permission-denied.html)

O acesso direto automatizado à documentação Mercado Livre também retornou 403; os requisitos citados foram consultados no conteúdo oficial indexado pela busca. Nenhuma chave, token ou código OAuth foi incluído neste relatório.
