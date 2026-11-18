"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Box,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Shirt,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const sections = [
  { name: "Visão geral", icon: LayoutDashboard },
  { name: "Catálogo de produtos", icon: Box },
  { name: "Concorrentes", icon: Users },
  { name: "Palavras-chave", icon: Search },
  { name: "Editor de anúncios", icon: FileText },
  { name: "Precificação", icon: CircleDollarSign },
  { name: "Performance histórica", icon: BarChart3 },
  { name: "Aprovações", icon: ClipboardCheck },
  { name: "Execuções dos agentes", icon: Activity },
  { name: "Integrações", icon: Settings },
];
const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n || 0,
  );
const agentNames: Record<string, string> = {
  competition: "Concorrência",
  seo: "SEO de anúncios",
  pricing: "Precificação",
  growth: "Crescimento",
};
type Json = Record<string, any>;
const initialPrice = {
  cost: 24,
  packaging: 2,
  shipping: 7,
  fixedFee: 0,
  feeRate: 0.16,
  taxRate: 0.06,
  adRate: 0.05,
  marginRate: 0.2,
  minimumPrice: 49.9,
};
const initialCSV =
  "sku,date,channel,orders,visits,revenue,adSpend,cost\nCONJ-001,2024-12-01,MERCADO_LIVRE,25,,1497.50,80,700";
export default function Home() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [email, setEmail] = useState("admin@example.local");
  const [password, setPassword] = useState("demo-seller-2026");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dashboard, setDashboard] = useState<Json>({});
  const [products, setProducts] = useState<Json[]>([]);
  const [approvals, setApprovals] = useState<Json[]>([]);
  const [runs, setRuns] = useState<Json[]>([]);
  const [competitors, setCompetitors] = useState<Json[]>([]);
  const [keywords, setKeywords] = useState<Json[]>([]);
  const [history, setHistory] = useState<Json>({
    historical: [],
    current: [],
    seasonality: [],
  });
  const [integration, setIntegration] = useState<Json>({});
  const [audit, setAudit] = useState<Json[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("p1");
  const [channel, setChannel] = useState("MERCADO_LIVRE");
  const [pricing, setPricing] = useState(initialPrice);
  const [quote, setQuote] = useState<Json | null>(null);
  const [csv, setCSV] = useState(initialCSV);
  const [delimiter, setDelimiter] = useState(",");
  const [mapping, setMapping] = useState<Json>(
    Object.fromEntries(
      [
        "sku",
        "date",
        "channel",
        "orders",
        "visits",
        "revenue",
        "adSpend",
        "cost",
      ].map((k) => [k, k]),
    ),
  );
  const [importResult, setImportResult] = useState<Json | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    price: 59.9,
  });
  const [newProduct, setNewProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    sku: "",
    name: "",
    category: "Conjuntos infantis",
    brand: "",
    fabric: "",
    pieces: 2,
    cost: 24,
    minimumPrice: 49.9,
    size: "2",
    color: "",
    stock: 10,
    validated: false,
  });
  const [competitorJSON, setCompetitorJSON] = useState("");
  const [keywordForm, setKeywordForm] = useState({ term: "", source: "" });
  useEffect(() => {
    setToken(sessionStorage.getItem("seller-token") || "");
    setReady(true);
  }, []);
  const api = useCallback(
    async (path: string, body?: unknown, auth = token) => {
      const response = await fetch(`${API}/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 && path !== "auth/login") {
          sessionStorage.removeItem("seller-token");
          setToken("");
        }
        throw new Error(
          data.message || "Não foi possível concluir a solicitação",
        );
      }
      return data;
    },
    [token],
  );
  const refresh = useCallback(async () => {
    if (!token) return;
    const result = await Promise.all(
      [
        "dashboard",
        "products",
        "approvals",
        "agents/runs",
        "competitors",
        "keywords",
        "performance",
        "integrations",
        "audit",
      ].map((path) => api(path)),
    );
    setDashboard(result[0]);
    setProducts(result[1]);
    setSelected((id) =>
      result[1].some((p: Json) => p.id === id) ? id : result[1][0]?.id || "",
    );
    setApprovals(result[2]);
    setRuns(result[3]);
    setCompetitors(result[4]);
    setKeywords(result[5]);
    setHistory(result[6]);
    setIntegration(result[7]);
    setAudit(result[8]);
  }, [token, api]);
  useEffect(() => {
    if (!token) return;
    void refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => void refresh().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [token, refresh]);
  async function action(
    fn: () => Promise<unknown>,
    success = "Alteração registrada",
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      setMessage(success);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("auth/login", { email, password }, "");
      sessionStorage.setItem("seller-token", data.token);
      setToken(data.token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function go(index: number) {
    setSection(index);
    setMobile(false);
    setSearch("");
    setError("");
    setMessage("");
  }
  async function run(agent: string) {
    await action(
      () =>
        api("agents/runs", {
          agent,
          productId: selected,
          channel,
          idempotencyKey: crypto.randomUUID(),
        }),
      "Execução enfileirada. O resultado aparecerá em Aprovações.",
    );
  }
  function productSelect() {
    return (
      <div className="toolbar">
        <label>
          Produto
          <select
            aria-label="Produto"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Marketplace
          <select
            aria-label="Marketplace"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="MERCADO_LIVRE">Mercado Livre</option>
            <option value="SHOPEE">Shopee</option>
          </select>
        </label>
      </div>
    );
  }
  const selectedProduct = products.find((p) => p.id === selected);
  const filtered = products.filter((p) =>
    `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()),
  );
  const historicalRevenue = (history.historical || []).reduce(
    (sum: number, row: Json) => sum + Number(row.revenue),
    0,
  );
  if (!ready) return <div className="login-wrap">Carregando…</div>;
  if (!token)
    return (
      <main className="login-wrap">
        <div className="card login">
          <Brand />
          <h1>Sua operação, mais inteligente.</h1>
          <p className="subtitle">
            Inteligência comercial para quem veste a infância.
          </p>
          <form onSubmit={login}>
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              Entrar no painel <ArrowRight size={15} />
            </button>
            <small>
              Credenciais preenchidas para demonstração local. Dados fictícios;
              nenhuma ação real é executada. No modo real, use as credenciais
              configuradas no servidor.
            </small>
          </form>
        </div>
      </main>
    );
  return (
    <div className="shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Brand />
        <p className="nav-label">Workspace</p>
        <nav>
          {sections.map((s, i) => (
            <button
              className={`nav-button ${section === i ? "active" : ""}`}
              key={s.name}
              onClick={() => go(i)}
            >
              <s.icon size={17} />
              {s.name}
              {i === 7 && dashboard.pending > 0 && (
                <span className="badge purple">{dashboard.pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">PS</div>
          <div>
            <strong>Pequeno Sol</strong>
            <p className="subtitle" style={{ marginTop: 3, fontSize: 9 }}>
              Moda infantil · operação local
            </p>
          </div>
          <button
            aria-label="Sair"
            className="icon-button"
            onClick={() => {
              sessionStorage.removeItem("seller-token");
              setToken("");
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            aria-label="Abrir menu"
            className="icon-button mobile-menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={21} />
          </button>
          <span className="breadcrumb">
            Workspace <ChevronRight size={11} className="inline mx-3" />{" "}
            {sections[section].name}
          </span>
          <div className="top-actions">
            <span className="status">● MODO {dashboard.mode || "…"}</span>
            <button
              aria-label="Ver aprovações"
              className="icon-button"
              onClick={() => go(7)}
            >
              <Bell size={18} />
            </button>
            <div className="avatar">PS</div>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow mb-2">
                SEU CENTRO DE INTELIGÊNCIA COMERCIAL
              </div>
              <h1>
                {section === 0
                  ? "Uma visão clara. Melhores decisões."
                  : sections[section].name}
              </h1>
              <p className="subtitle">
                {
                  [
                    "Acompanhe sua operação e transforme dados em oportunidades.",
                    "Organize fichas técnicas, variações e estoque em um só lugar.",
                    "Compare produtos equivalentes com evidências rastreáveis.",
                    "Termos verificáveis para anúncios mais relevantes.",
                    "Crie propostas fundamentadas e revise antes de publicar.",
                    "Encontre o equilíbrio entre competitividade e margem.",
                    "Aprenda com o passado, sem confundir períodos.",
                    "Você decide o que acontece na sua operação.",
                    "Transparência em cada análise e recomendação.",
                    "Conexões seguras e status explícito dos canais.",
                  ][section]
                }
              </p>
            </div>
            <button
              className="button"
              disabled={busy}
              onClick={() => void action(refresh, "Painel atualizado")}
            >
              <RefreshCw size={13} /> Atualizar dados
            </button>
          </div>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          {message && (
            <div role="status" className="notice">
              {message}
            </div>
          )}
          {dashboard.killSwitch && (
            <div className="notice error">
              Agentes pausados pelo kill switch. Retome em Execuções dos
              agentes.
            </div>
          )}
          {section === 0 && (
            <>
              <div className="metrics">
                <Metric
                  label="Receita atual"
                  value={
                    dashboard.current?.records
                      ? money(dashboard.current.revenue)
                      : "Sem dados"
                  }
                  note="Somente registros do período atual"
                  icon={CircleDollarSign}
                />
                <Metric
                  label="Produtos no catálogo"
                  value={String(dashboard.products ?? "—")}
                  note={`${dashboard.stock ?? 0} unidades em estoque`}
                  icon={Box}
                />
                <Metric
                  label="Aguardando sua revisão"
                  value={String(dashboard.pending ?? 0).padStart(2, "0")}
                  note="Propostas com aprovação humana"
                  icon={ClipboardCheck}
                />
                <Metric
                  label="Receita histórica"
                  value={money(historicalRevenue)}
                  note="2020–2024 · dados fictícios no mock"
                  icon={TrendingUp}
                />
              </div>
              <div className="grid-main">
                <div className="card">
                  <div className="card-heading">
                    <h2>Uma perspectiva do seu histórico</h2>
                    <span className="badge purple">2020 — 2024</span>
                  </div>
                  <p className="eyebrow">
                    Receita por ano · base histórica, sem projeções
                  </p>
                  <div className="chart">
                    {[2020, 2021, 2022, 2023, 2024].map((year) => {
                      const n = history.historical
                        .filter(
                          (r: Json) =>
                            new Date(r.date).getUTCFullYear() === year,
                        )
                        .reduce(
                          (s: number, r: Json) => s + Number(r.revenue),
                          0,
                        );
                      const max = Math.max(
                        1,
                        ...[2020, 2021, 2022, 2023, 2024].map((y) =>
                          history.historical
                            .filter(
                              (r: Json) =>
                                new Date(r.date).getUTCFullYear() === y,
                            )
                            .reduce(
                              (s: number, r: Json) => s + Number(r.revenue),
                              0,
                            ),
                        ),
                      );
                      return (
                        <div
                          title={`${year}: ${money(n)}`}
                          key={year}
                          className="chart-column"
                          style={{ height: `${(n / max) * 100}%` }}
                        >
                          <span>{year}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="eyebrow mt-5">
                    Fonte: registros históricos importados. Não representa
                    faturamento atual.
                  </p>
                </div>
                <div className="card">
                  <div className="card-heading">
                    <h2>Seus agentes de IA</h2>
                    <Sparkles size={16} color="#8d76d9" />
                  </div>
                  <p className="eyebrow">Especialistas trabalhando com você</p>
                  {Object.entries(agentNames).map(([key, name], i) => (
                    <div className="agent-item" key={key}>
                      <div className="agent-icon">
                        {
                          [
                            <Users size={16} key="u" />,
                            <Search size={16} key="s" />,
                            <CircleDollarSign size={16} key="p" />,
                            <TrendingUp size={16} key="g" />,
                          ][i]
                        }
                      </div>
                      <div>
                        <h3>{name}</h3>
                        <p>
                          {
                            [
                              "Evidências e produtos equivalentes",
                              "Anúncios fiéis à ficha técnica",
                              "Margens antes de decisões",
                              "Experimentos com dados observados",
                            ][i]
                          }
                        </p>
                      </div>
                      <span
                        className={`badge ${dashboard.killSwitch ? "amber" : "purple"}`}
                      >
                        {dashboard.killSwitch ? "Pausado" : "Disponível"}
                      </span>
                    </div>
                  ))}
                  <button
                    className="icon-button mt-4 text-xs"
                    onClick={() => go(8)}
                  >
                    Ver todas as execuções <ArrowRight size={12} />
                  </button>
                </div>
              </div>
              <ProductTable
                products={products}
                onOpen={(p) => {
                  setSelected(p.id);
                  go(4);
                }}
              />
              <div className="callout">
                <ShieldCheck size={27} />
                <div>
                  <h3>Inteligência artificial. Controle humano.</h3>
                  <p>
                    Recomendações ficam na central de aprovações. Publicações e
                    ações financeiras reais estão bloqueadas neste MVP.
                  </p>
                </div>
                <button
                  className="icon-button ml-auto"
                  onClick={() => go(7)}
                  aria-label="Abrir central de aprovações"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
          {section === 1 && (
            <>
              <div className="toolbar">
                <input
                  className="search"
                  aria-label="Buscar produtos"
                  placeholder="Buscar por nome ou SKU…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  className="button primary"
                  onClick={() => setNewProduct(!newProduct)}
                >
                  <Plus size={14} />
                  Novo produto
                </button>
              </div>
              {newProduct && (
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      const { size, color, stock, ...rest } = productForm;
                      await api("products", {
                        ...rest,
                        variations: [{ size, color, stock }],
                      });
                      setNewProduct(false);
                    }, "Produto cadastrado");
                  }}
                >
                  <h2>Ficha técnica</h2>
                  <div className="form-grid">
                    {Object.entries(productForm)
                      .filter(([k]) => k !== "validated")
                      .map(([key, value]) => (
                        <label key={key}>
                          {
                            (
                              {
                                sku: "SKU",
                                name: "Nome",
                                category: "Categoria",
                                brand: "Marca",
                                fabric: "Tecido",
                                pieces: "Quantidade de peças",
                                cost: "Custo (R$)",
                                minimumPrice: "Preço mínimo (R$)",
                                size: "Tamanho",
                                color: "Cor",
                                stock: "Estoque",
                              } as Json
                            )[key]
                          }
                          <input
                            required
                            value={value as string | number}
                            type={typeof value === "number" ? "number" : "text"}
                            min={typeof value === "number" ? 0 : undefined}
                            step={
                              ["cost", "minimumPrice"].includes(key)
                                ? ".01"
                                : undefined
                            }
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                [key]:
                                  typeof value === "number"
                                    ? Number(e.target.value)
                                    : e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                  </div>
                  <label className="flex-row items-center mb-5">
                    <input
                      type="checkbox"
                      checked={productForm.validated}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          validated: e.target.checked,
                        })
                      }
                    />
                    Confirmo que a ficha técnica foi conferida.
                  </label>
                  <button className="button primary" disabled={busy}>
                    Salvar produto
                  </button>
                </form>
              )}
              <ProductTable
                products={filtered}
                onOpen={(p) => {
                  setSelected(p.id);
                  go(4);
                }}
              />
            </>
          )}
          {section === 2 && (
            <div className="stack">
              <div className="card">
                {productSelect()}
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void run("competition")}
                >
                  <Sparkles size={14} />
                  Analisar equivalentes
                </button>
                <p className="subtitle">
                  Equivalência por categoria, marca, tecido, tamanho e
                  quantidade. Preço comparado inclui frete.
                </p>
              </div>
              <div className="card">
                <h2>Snapshots de concorrentes</h2>
                {competitors.map((c) => (
                  <div className="status-row" key={c.id}>
                    <div>
                      <strong>{c.data.name}</strong>
                      <p className="subtitle">
                        {c.source} ·{" "}
                        {new Date(c.capturedAt).toLocaleDateString("pt-BR")} ·
                        vendas: {c.data.sales ?? "não informadas"}
                      </p>
                    </div>
                    <strong>
                      {money(Number(c.data.price) + Number(c.data.shipping))}
                    </strong>
                  </div>
                ))}
                {!competitors.length && (
                  <Empty text="Importe dados autorizados para iniciar a análise." />
                )}
              </div>
              <form
                className="card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    () => api("competitors/import", JSON.parse(competitorJSON)),
                    "Snapshots importados",
                  );
                }}
              >
                <h2>Importar JSON autorizado</h2>
                <p className="subtitle mb-4">
                  Use o contrato documentado em docs/API.md. Inclua origem e
                  data de captura.
                </p>
                <textarea
                  aria-label="JSON de concorrentes"
                  className="w-full"
                  required
                  placeholder='[{"externalId":"...","source":"arquivo autorizado",...}]'
                  value={competitorJSON}
                  onChange={(e) => setCompetitorJSON(e.target.value)}
                />
                <button className="button mt-4" disabled={busy}>
                  <ArrowDownToLine size={14} />
                  Importar snapshots
                </button>
              </form>
            </div>
          )}
          {section === 3 && (
            <div className="section-grid">
              <div className="card">
                <h2>Biblioteca de palavras-chave</h2>
                <input
                  className="w-full my-5"
                  aria-label="Buscar termos"
                  placeholder="Pesquisar termo ou fonte…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {keywords
                  .filter((k) =>
                    `${k.term} ${k.source}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((k) => (
                    <div className="status-row" key={k.id}>
                      <div>
                        <strong>{k.term}</strong>
                        <p className="subtitle">{k.source}</p>
                      </div>
                      <span className="badge gray">
                        {k.volume === null
                          ? "Volume indisponível"
                          : `${k.volume} · informado`}
                      </span>
                    </div>
                  ))}
              </div>
              <form
                className="card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    () => api("keywords", { ...keywordForm, volume: null }),
                    "Termo cadastrado com origem",
                  );
                }}
              >
                <h2>Adicionar termo verificado</h2>
                <div className="form-grid">
                  <label>
                    Termo
                    <input
                      required
                      value={keywordForm.term}
                      onChange={(e) =>
                        setKeywordForm({ ...keywordForm, term: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Fonte verificável
                    <input
                      required
                      minLength={3}
                      value={keywordForm.source}
                      onChange={(e) =>
                        setKeywordForm({
                          ...keywordForm,
                          source: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <button className="button primary" disabled={busy}>
                  Salvar termo
                </button>
                <p className="subtitle">
                  Nenhum volume de busca é estimado ou criado pela IA.
                </p>
              </form>
            </div>
          )}
          {section === 4 && (
            <>
              <div className="card mb-6">
                {productSelect()}
                <button
                  className="button primary"
                  onClick={() => void run("seo")}
                  disabled={busy}
                >
                  <Sparkles size={14} />
                  Gerar proposta SEO
                </button>
                <p className="subtitle">
                  A proposta usa apenas a ficha validada. Veja o resultado em
                  Aprovações.
                </p>
              </div>
              <div className="section-grid">
                <form
                  className="card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(
                      () =>
                        api("listings/draft", {
                          ...draft,
                          productId: selected,
                          channel,
                        }),
                      "Versão salva para aprovação",
                    );
                  }}
                >
                  <h2>Editor de proposta</h2>
                  <div className="stack mt-5">
                    <label>
                      Título
                      <input
                        required
                        maxLength={channel === "MERCADO_LIVRE" ? 60 : 120}
                        value={draft.title}
                        onChange={(e) =>
                          setDraft({ ...draft, title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Descrição
                      <textarea
                        required
                        value={draft.description}
                        onChange={(e) =>
                          setDraft({ ...draft, description: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Preço (R$)
                      <input
                        type="number"
                        required
                        min={Number(selectedProduct?.minimumPrice) || 0}
                        step=".01"
                        value={draft.price}
                        onChange={(e) =>
                          setDraft({ ...draft, price: Number(e.target.value) })
                        }
                      />
                    </label>
                    <button className="button primary" disabled={busy}>
                      <ClipboardCheck size={14} />
                      Salvar para aprovação
                    </button>
                  </div>
                </form>
                <div className="card">
                  <div className="eyebrow">
                    PRÉVIA · {channel.replace("_", " ")}
                  </div>
                  <div
                    className="product-thumb mt-6"
                    style={{ width: 90, height: 95 }}
                  >
                    <Shirt size={45} />
                  </div>
                  <h2 className="preview-title">
                    {draft.title || "Seu título aparecerá aqui"}
                  </h2>
                  <div className="price-number">{money(draft.price)}</div>
                  <p className="subtitle whitespace-pre-wrap">
                    {draft.description ||
                      "A descrição deve refletir exclusivamente a ficha técnica validada."}
                  </p>
                  <div className="notice mt-6">
                    Limites locais conservadores de rascunho. A política atual
                    de categoria deve ser validada antes de qualquer publicação
                    real.
                  </div>
                </div>
              </div>
            </>
          )}
          {section === 5 && (
            <div className="section-grid">
              <form
                className="card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    async () =>
                      setQuote(await api("pricing/simulate", pricing)),
                    "Simulação calculada",
                  );
                }}
              >
                <h2>Custos e objetivo de margem</h2>
                <p className="subtitle">
                  Informe valores reais do canal. Percentuais em fração: 0,16 =
                  16%.
                </p>
                <div className="form-grid">
                  {Object.entries(pricing).map(([key, value]) => (
                    <label key={key}>
                      {
                        (
                          {
                            cost: "Custo do produto",
                            packaging: "Embalagem",
                            shipping: "Frete do vendedor",
                            fixedFee: "Tarifa fixa",
                            feeRate: "Taxa do canal",
                            taxRate: "Impostos",
                            adRate: "Publicidade",
                            marginRate: "Margem desejada",
                            minimumPrice: "Preço mínimo",
                          } as Json
                        )[key]
                      }
                      <input
                        type="number"
                        required
                        min={key === "minimumPrice" ? ".01" : "0"}
                        max={key.endsWith("Rate") ? ".99" : undefined}
                        step=".01"
                        value={value}
                        onChange={(e) =>
                          setPricing({
                            ...pricing,
                            [key]: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <button className="button primary" disabled={busy}>
                  <FlaskConical size={14} />
                  Calcular preço
                </button>
              </form>
              <div className="card">
                <h2>Preço com margem protegida</h2>
                {quote ? (
                  <>
                    <p className="price-number">{money(quote.recommended)}</p>
                    <div className="status-row">
                      <span>Contribuição por venda</span>
                      <strong>{money(quote.contribution)}</strong>
                    </div>
                    <div className="status-row">
                      <span>Margem efetiva</span>
                      <strong>{(quote.marginRate * 100).toFixed(2)}%</strong>
                    </div>
                    <div className="status-row">
                      <span>Piso aplicado</span>
                      <strong>{quote.minimumApplied ? "Sim" : "Não"}</strong>
                    </div>
                    <p className="subtitle mt-6">{quote.formula}</p>
                  </>
                ) : (
                  <Empty text="Preencha os custos para simular uma recomendação." />
                )}
                <div className="notice mt-6">
                  A simulação não altera anúncios. Nenhum orçamento publicitário
                  é modificado.
                </div>
              </div>
            </div>
          )}
          {section === 6 && (
            <div className="stack">
              <div className="metrics">
                <Metric
                  label="Receita 2020–2024"
                  value={money(historicalRevenue)}
                  note="Base histórica importada"
                  icon={BookOpen}
                />
                <Metric
                  label="Registros históricos"
                  value={String(history.historical.length)}
                  note="Separados dos indicadores atuais"
                  icon={FileText}
                />
                <Metric
                  label="Registros atuais"
                  value={String(history.current.length)}
                  note="Sem inferência a partir do passado"
                  icon={Activity}
                />
                <Metric
                  label="Pedidos históricos"
                  value={String(
                    history.historical.reduce(
                      (s: number, r: Json) => s + r.orders,
                      0,
                    ),
                  )}
                  note="Dados fictícios no modo mock"
                  icon={Box}
                />
              </div>
              <form
                className="card"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    async () =>
                      setImportResult(
                        await api("history/import", {
                          csv,
                          mapping,
                          delimiter,
                          dryRun: true,
                        }),
                      ),
                    "Validação concluída",
                  );
                }}
              >
                <h2>Importar vendas e anúncios de 2020 a 2024</h2>
                <p className="subtitle mb-5">
                  Arquivo sem dados de compradores. A importação é integral:
                  qualquer erro cancela a gravação.
                </p>
                <label>
                  Arquivo CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void file.text().then(setCSV);
                    }}
                  />
                </label>
                <label className="mt-5">
                  Conteúdo
                  <textarea
                    value={csv}
                    onChange={(e) => {
                      setCSV(e.target.value);
                      setImportResult(null);
                    }}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Delimitador
                    <select
                      value={delimiter}
                      onChange={(e) => setDelimiter(e.target.value)}
                    >
                      <option value=",">Vírgula</option>
                      <option value=";">Ponto e vírgula</option>
                    </select>
                  </label>
                  {Object.entries(mapping).map(([key, value]) => (
                    <label key={key}>
                      Coluna: {key}
                      <input
                        required
                        value={value}
                        onChange={(e) =>
                          setMapping({ ...mapping, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="toolbar">
                  <button className="button" disabled={busy}>
                    Validar sem importar
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        async () =>
                          setImportResult(
                            await api("history/import", {
                              csv,
                              mapping,
                              delimiter,
                              dryRun: false,
                            }),
                          ),
                        "Solicitação de importação processada",
                      )
                    }
                  >
                    Importar dados históricos
                  </button>
                </div>
                {importResult && (
                  <pre className="result">
                    {JSON.stringify(importResult, null, 2)}
                  </pre>
                )}
              </form>
              <div className="card">
                <h2>Sazonalidade observada · pedidos por mês</h2>
                <p className="subtitle mb-4">
                  Apenas meses presentes no conjunto importado; ausência de
                  dados não significa ausência de vendas.
                </p>
                {history.seasonality
                  .filter((m: Json) => m.orders > 0)
                  .map((m: Json) => (
                    <div className="status-row" key={m.month}>
                      <span>Mês {m.month}</span>
                      <strong>{m.orders} pedidos</strong>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {section === 7 && (
            <>
              <div className="notice">
                Aprovar registra sua decisão. A execução externa permanece
                bloqueada até homologação das integrações.
              </div>
              <div className="section-grid">
                {approvals
                  .slice()
                  .reverse()
                  .map((a) => (
                    <article className="card approval" key={a.id}>
                      <div className="card-heading">
                        <h2>{agentNames[a.kind] || "Proposta de anúncio"}</h2>
                        <Badge status={a.status} />
                      </div>
                      <p className="eyebrow">
                        {products.find((p) => p.id === a.productId)?.name ||
                          a.productId}{" "}
                        · {new Date(a.createdAt).toLocaleString("pt-BR")}
                      </p>
                      <pre className="result">
                        {JSON.stringify(a.payload, null, 2)}
                      </pre>
                      {a.payload?.draft && (
                        <button
                          className="button"
                          onClick={() => {
                            setSelected(a.productId);
                            setChannel(a.payload.draft.channel);
                            setDraft({
                              title: a.payload.draft.title,
                              description: a.payload.draft.description,
                              price:
                                Number(
                                  products.find((p) => p.id === a.productId)
                                    ?.minimumPrice,
                                ) || 59.9,
                            });
                            go(4);
                          }}
                        >
                          Abrir no editor <ArrowRight size={13} />
                        </button>
                      )}
                      {a.status === "PENDING" ? (
                        <div className="approval-actions">
                          <button
                            disabled={busy}
                            className="button primary"
                            onClick={() =>
                              void action(
                                () =>
                                  api(`approvals/${a.id}/review`, {
                                    decision: "APPROVED",
                                  }),
                                "Proposta aprovada, sem publicação externa",
                              )
                            }
                          >
                            <Check size={14} />
                            Aprovar
                          </button>
                          <button
                            disabled={busy}
                            className="button danger"
                            onClick={() =>
                              void action(
                                () =>
                                  api(`approvals/${a.id}/review`, {
                                    decision: "REJECTED",
                                  }),
                                "Proposta rejeitada",
                              )
                            }
                          >
                            <X size={14} />
                            Rejeitar
                          </button>
                        </div>
                      ) : (
                        <p className="eyebrow">Revisado por {a.reviewedBy}</p>
                      )}
                    </article>
                  ))}
              </div>
              {!approvals.length && (
                <div className="card">
                  <Empty text="Nenhuma proposta pendente. Execute um agente para gerar a primeira." />
                  <button className="button primary" onClick={() => go(8)}>
                    Executar agente <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
          {section === 8 && (
            <div className="stack">
              <div className="card">
                <div className="card-heading">
                  <h2>Controle dos agentes</h2>
                  <button
                    className={`button ${dashboard.killSwitch ? "primary" : "danger"}`}
                    disabled={busy}
                    onClick={() =>
                      void action(
                        () =>
                          api("agents/kill-switch", {
                            enabled: !dashboard.killSwitch,
                          }),
                        dashboard.killSwitch
                          ? "Agentes retomados"
                          : "Agentes pausados",
                      )
                    }
                  >
                    {dashboard.killSwitch ? (
                      <Play size={14} />
                    ) : (
                      <Pause size={14} />
                    )}{" "}
                    {dashboard.killSwitch
                      ? "Retomar agentes"
                      : "Pausar todos os agentes"}
                  </button>
                </div>
                {productSelect()}
                <div className="toolbar">
                  {Object.entries(agentNames).map(([key, name]) => (
                    <button
                      key={key}
                      className="button"
                      disabled={busy || dashboard.killSwitch || !selected}
                      onClick={() => void run(key)}
                    >
                      <Zap size={13} />
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2>Execuções</h2>
                {runs
                  .slice()
                  .reverse()
                  .map((r) => (
                    <div className="status-row" key={r.id}>
                      <div>
                        <strong>{agentNames[r.agent]}</strong>
                        <p className="subtitle">
                          {r.id} · tentativas: {r.attempts} ·{" "}
                          {r.result?.error ||
                            "Resultado disponível nas aprovações"}
                        </p>
                      </div>
                      <Badge status={r.status} />
                    </div>
                  ))}
                {!runs.length && <Empty text="Nenhuma execução registrada." />}
              </div>
              <div className="card">
                <h2>Trilha de auditoria</h2>
                {audit
                  .slice(-30)
                  .reverse()
                  .map((a) => (
                    <div key={a.id} className="status-row">
                      <span>
                        {a.action}
                        <p className="subtitle">{a.actor}</p>
                      </span>
                      <span className="eyebrow">
                        {new Date(a.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {section === 9 && (
            <>
              <div className="notice">
                Modo {integration.mode}. Segredos ficam no servidor. Integrações
                reais dependem de credenciais, permissões e homologação.
              </div>
              <div className="section-grid">
                {["Mercado Livre", "Shopee"].map((name, i) => (
                  <div className="card" key={name}>
                    <div className="card-heading">
                      <h2>{name}</h2>
                      <span className="badge amber">
                        {i === 0 && integration.mercadoLivre?.connected
                          ? "OAuth conectado"
                          : integration.mode === "MOCK"
                            ? "Mock explícito"
                            : "Não conectado"}
                      </span>
                    </div>
                    <p className="subtitle">
                      {i === 0
                        ? "OAuth e leitura de anúncios implementados, sem homologação nesta conta."
                        : "Contratos tipados e adapter mock. Integração real ainda não homologada."}
                    </p>
                    <div className="status-row">
                      <span>Publicação automática</span>
                      <strong>Bloqueada</strong>
                    </div>
                    <div className="status-row">
                      <span>Alteração de publicidade</span>
                      <strong>Bloqueada</strong>
                    </div>
                    <div className="toolbar mt-6">
                      {i === 0 && (
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            void action(
                              async () => {
                                const r = await api(
                                  "integrations/ml/authorize",
                                );
                                if (r.url) window.location.assign(r.url);
                                else setMessage(r.message);
                              },
                              integration.mode === "MOCK"
                                ? "OAuth desabilitado no mock"
                                : "Autorização preparada",
                            )
                          }
                        >
                          Conectar OAuth <ArrowRight size={13} />
                        </button>
                      )}
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            const r = await api(
                              `integrations/${i === 0 ? "ml" : "shopee"}/items`,
                            );
                            setMessage(JSON.stringify(r));
                          }, "Consulta concluída; veja o modo na configuração")
                        }
                      >
                        Consultar adapter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="footer-note">
            SELLER AGENTS AI · DADOS COM ORIGEM. DECISÕES COM CONTROLE. · MVP
            0.1
          </p>
        </main>
      </div>
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <Sparkles size={21} />
      </div>
      <div>
        seller agents<span style={{ color: "#8c76d4" }}> ai</span>
        <small>INTELIGÊNCIA QUE CONVERTE</small>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
}) {
  return (
    <div className="card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={16} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <p className="metric-note">{note}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}
function Badge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    PENDING: "Em revisão",
    APPROVED: "Aprovada",
    REJECTED: "Rejeitada",
    QUEUED: "Na fila",
    RUNNING: "Executando",
    SUCCEEDED: "Concluída",
    FAILED: "Falhou",
  };
  return (
    <span
      className={`badge ${["PENDING", "QUEUED", "RUNNING"].includes(status) ? "amber" : ["REJECTED", "FAILED"].includes(status) ? "red" : ""}`}
    >
      {labels[status] || status}
    </span>
  );
}
function ProductTable({
  products,
  onOpen,
}: {
  products: Json[];
  onOpen: (p: Json) => void;
}) {
  return (
    <div className="card table-card">
      <div className="table-header">
        <div>
          <h2>Seu catálogo em foco</h2>
          <p className="subtitle">Fichas técnicas e variações validadas</p>
        </div>
        <span className="badge gray">{products.length} produtos</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Variações</th>
              <th>Custo</th>
              <th>Preço mínimo</th>
              <th>Estoque</th>
              <th>Ficha técnica</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="product-cell">
                    <div className="product-thumb">
                      <Shirt size={23} />
                    </div>
                    <div>
                      {p.name}
                      <small>
                        {p.sku} · {p.brand}
                      </small>
                    </div>
                  </div>
                </td>
                <td>{p.variations.map((v: Json) => v.size).join(" / ")}</td>
                <td>{money(Number(p.cost))}</td>
                <td className="font-semibold">
                  {money(Number(p.minimumPrice))}
                </td>
                <td>
                  {p.variations.reduce((s: number, v: Json) => s + v.stock, 0)}{" "}
                  un.
                </td>
                <td>
                  <span className={`badge ${p.validated ? "" : "amber"}`}>
                    {p.validated ? "Validada" : "Pendente"}
                  </span>
                </td>
                <td>
                  <button
                    aria-label={`Editar anúncio ${p.sku}`}
                    className="icon-button"
                    onClick={() => onOpen(p)}
                  >
                    <ArrowRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!products.length && <Empty text="Nenhum produto encontrado." />}
      </div>
    </div>
  );
}
