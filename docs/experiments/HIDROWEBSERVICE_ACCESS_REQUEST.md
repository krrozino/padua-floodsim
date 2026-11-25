# Solicitação de Acesso Institucional — ANA HidroWebService e INEA

**Projeto:** Pádua FloodSim (pesquisa acadêmica sobre monitoramento e previsão hidrológica do Rio Pomba em Santo Antônio de Pádua, RJ)  
**Issue relacionada:** [#37](https://github.com/krrozino/padua-floodsim/issues/37)  
**Data da auditoria:** 2026-11-25

---

## 1. ANA / SNIRH — API HidroWebService

### Achado técnico da auditoria
- O endpoint REST moderno (`https://www.snirh.gov.br/hidroweb/rest/api/estacao` e rotas `/documento/*`) responde **HTTP 401 (`Unauthorized`)** com a mensagem:
  > `Token de Autenticação da API Inexistente ou mal Formatado, Verifique!`
- O endpoint Swagger/API em `https://www.ana.gov.br/hidrowebservice/` retornou **HTTP 503** durante a verificação de 2026-11-25.
- O acesso automatizado à nova API exige credenciais institucionais solicitadas formalmente à ANA; não se deve tentar contornar autenticação.

### Procedimento oficial de cadastro e autenticação
Referências oficiais verificadas:
- Portal HidroWeb / Acesso API: https://www.snirh.gov.br/hidroweb/acesso-api
- Manuais de sistemas e serviços da ANA: https://www.gov.br/ana/pt-br/assuntos/monitoramento-e-eventos-criticos/monitoramento-hidrologico/orientacoes-manuais/manuais-de-sistemas-e-servicos-de-disponibilizacao-de-dados-hidrologicos

Passos oficiais:
1. Enviar solicitação por e-mail para `hidro@ana.gov.br` (ou `telemetria@ana.gov.br`).
2. Usar assunto no formato:
   `[CPF ou CNPJ do responsável] - Solicitação de acesso à API HidroWebService para consumo de dados`
3. Após receber Identificador e Senha inicial, gerar token via rota de autenticação no Swagger (`OAUth/v1` / `Autenticar`).
4. O token tem validade limitada (tipicamente **60 minutos**) e deve ser reutilizado durante sua janela de validade para evitar bloqueio por excesso de requisições.
5. Armazenar credenciais exclusivamente em variáveis de ambiente locais / secrets autorizados (`.env*` bloqueado no `.gitignore` e verificado pelo Gitleaks no CI).

### Minuta pronta para envio pelo responsável do projeto

```text
Para: hidro@ana.gov.br, telemetria@ana.gov.br
Assunto: [PREENCHER CPF OU CNPJ] - Solicitação de acesso à API HidroWebService para consumo de dados

Prezados(as),

Solicito credenciamento de acesso à API HidroWebService para consumo automatizado de dados hidrológicos (nível, vazão e precipitação) da Bacia do Rio Pomba, exclusivamente para fins de pesquisa acadêmica reproduzível no projeto Pádua FloodSim (estudo sobre monitoramento e previsão de cheias em Santo Antônio de Pádua, RJ).

Dados do solicitante:
- Nome completo: [PREENCHER NOME DO RESPONSÁVEL]
- Instituição / Vínculo acadêmico: [PREENCHER UNIVERSIDADE / PROGRAMA]
- CPF/CNPJ (identificador): [PREENCHER CPF OU CNPJ]
- E-mail institucional/contato: [PREENCHER E-MAIL]
- Estações de interesse prioritário (RHN): 58790002 (Santo Antônio de Pádua II), 58788600 (UHE Barra do Braúna Jusante), 58770000 (Cataguases) e pluviômetros municipais (ex.: 2142067).

Comprometemo-nos a respeitar os limites de requisição, renovar tokens somente quando expirados, manter atribuição à ANA/SGB-CPRM e não redistribuir dados em desacordo com os termos da plataforma.

Atenciosamente,
[PREENCHER ASSINATURA]
```

---

## 2. INEA — Histórico plurianual e referência de régua (`213042120`)

### Achado técnico da auditoria
- O feed XML público (`https://alertadecheias.inea.rj.gov.br/alertadecheias/21304212020.xml`) expõe `<estacao codigo="213042120" tipo="Plu/Flu">` apenas com janela móvel dos **últimos 10 dias** (~960 registros a cada 15 min).
- Não há arquivo histórico plurianual (ex.: 2022–2023) nem metadata de zero da régua / datum vertical nesse endpoint.
- Comparação simultânea de 10 dias contra a estação RHN `58790002` mostrou diferença não constante, inviabilizando conversão direta sem calibração e metadados oficiais.

### Minuta pronta para solicitação ao INEA

```text
Para: [CANAL OFICIAL / OUVIDORIA / MONITORAMENTO HIDROMETEOROLÓGICO DO INEA]
Assunto: Solicitação acadêmica de série histórica e metadados de referência da estação Santo Antônio de Pádua (código 213042120)

Prezados(as),

No âmbito do projeto acadêmico experimental Pádua FloodSim (pesquisa sobre monitoramento e previsão hidrológica no Rio Pomba em Santo Antônio de Pádua, RJ), solicitamos gentilmente, se disponíveis para uso científico com devida atribuição ao INEA:

1. Série histórica observada (nível do rio e precipitação, idealmente 2020–2026 ou eventos de cheia de jan/2022 e jan/2023) da estação Santo Antônio de Pádua (código XML 213042120 / página 21304212020.html);
2. Metadados de referência da régua fluviométrica: coordenadas exatas, zero da régua, datum vertical (ex.: IBGE/Imbituba ou local), histórico de eventuais alterações de régua e fuso horário dos registros;
3. Termos de uso, licença de guarda e eventual autorização de citação/derivados para publicação científica.

Atenciosamente,
[PREENCHER NOME, INSTITUIÇÃO E CONTATO]
```
