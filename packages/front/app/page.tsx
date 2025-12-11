"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

type Chain = {
  id: number;
  name: string;
  rpcUrl: string;
  chainId: number; // L1/L2 체인 식별자
};

type Subscription = {
  id: number;
  chainId: number;
  contractAddress: string;
  eventName: string;
  description?: string | null;
  abi: unknown[];
  fromBlock?: number;
  isActive?: boolean;
};

type CollectedEvent = {
  id: number;
  subscriptionId: number;
  chainId: number;
  contractAddress: string;
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  data: Record<string, string>;
  createdAt?: string;
};

type Stats = {
  totalEvents: number;
  totalSubscriptions: number;
  totalChains: number;
};

const apiBase =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ??
  "http://localhost:9000";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [events, setEvents] = useState<CollectedEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<CollectedEvent | null>(null);

  const [chainForm, setChainForm] = useState({
    name: "",
    rpcUrl: "",
    chainId: 1,
  });

  const [subForm, setSubForm] = useState({
    chainId: "",
    contractAddress: "",
    eventName: "",
    description: "",
    abi: "[]",
    fromBlock: "",
  });

  const socketRef = useRef<Socket | null>(null);

  const authHeaders = useMemo(() => {
    const headers: HeadersInit = new Headers();
    headers.set("Content-Type", "application/json");
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    return headers;
  }, [accessToken]);

  const apiFetch = async <T,>(
    path: string,
    options?: RequestInit
  ): Promise<T> => {
    const mergedHeaders = new Headers(authHeaders as HeadersInit);
    const extraHeaders = options?.headers as HeadersInit | undefined;
    if (extraHeaders) {
      const extras = new Headers(extraHeaders);
      extras.forEach((value, key) => mergedHeaders.set(key, value));
    }
    // 기본값으로 항상 application/json
    if (!mergedHeaders.has("Content-Type")) {
      mergedHeaders.set("Content-Type", "application/json");
    }

    const res = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: mergedHeaders,
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || res.statusText);
    }
    return res.json();
  };

  type EthProvider = {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  };

  const getMetaMaskProvider = (): EthProvider | null => {
    const global = window as unknown as {
      ethereum?: EthProvider & { providers?: EthProvider[] };
      ethereumProviders?: EthProvider[];
    };
    const providerList: EthProvider[] =
      global.ethereum?.providers ??
      global.ethereumProviders ??
      (global.ethereum ? [global.ethereum] : []);

    if (!providerList.length) return null;

    const metamask = providerList.find((p) => p?.isMetaMask) ?? providerList[0];
    return metamask?.isMetaMask ? metamask : null;
  };

  const connectWallet = async () => {
    const mm = getMetaMaskProvider();
    if (!mm) {
      alert("Metamask가 필요합니다.");
      return;
    }
    try {
      const accounts = (await mm.request({
        method: "eth_requestAccounts",
      })) as string[];
      const [address] = accounts;
      const message = `Login to Event Collector\n${Date.now()}`;
      const signature = (await mm.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      const result = await apiFetch<{
        accessToken: string;
        refreshToken: string;
      }>("/api/v1/auth/wallet/login", {
        method: "POST",
        body: JSON.stringify({ address, message, signature }),
      });

      setWalletAddress(address);
      setAccessToken(result.accessToken);
      localStorage.setItem("accessToken", result.accessToken);
      localStorage.setItem("refreshToken", result.refreshToken);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "지갑 로그인 실패";
      alert(msg);
    }
  };

  const refreshToken = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return;
    try {
      const res = await apiFetch<{
        accessToken: string;
        refreshToken: string;
      }>("/api/v1/auth/token/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
      setAccessToken(res.accessToken);
      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);
    } catch (error: unknown) {
      console.error("토큰 갱신 실패", error);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const [chainsRes, subsRes, eventsRes, statsRes] = await Promise.all([
        apiFetch<Chain[]>("/api/chains"),
        apiFetch<Subscription[]>("/api/subscriptions"),
        apiFetch<CollectedEvent[]>("/api/events?limit=50"),
        apiFetch<Stats>("/api/events/stats"),
      ]);
      setChains(chainsRes);
      setSubscriptions(subsRes);
      setEvents(eventsRes);
      setStats(statsRes);
    } catch (error: unknown) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const addChain = async () => {
    try {
      await apiFetch("/api/chains", {
        method: "POST",
        body: JSON.stringify(chainForm),
      });
      await loadAll();
      setChainForm({ name: "", rpcUrl: "", chainId: 1 });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "체인 추가 실패";
      alert(msg);
    }
  };

  const addSubscription = async () => {
    try {
      const abiParsed = JSON.parse(subForm.abi || "[]");
      await apiFetch("/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          chainId: Number(subForm.chainId),
          contractAddress: subForm.contractAddress,
          eventName: subForm.eventName,
          description: subForm.description || undefined,
          abi: abiParsed,
          fromBlock: subForm.fromBlock ? Number(subForm.fromBlock) : undefined,
        }),
      });
      await loadAll();
      setSubForm({
        chainId: "",
        contractAddress: "",
        eventName: "",
        description: "",
        abi: "[]",
        fromBlock: "",
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "구독 추가 실패";
      alert(msg);
    }
  };

  const toggleSubscription = async (id: number, isActive: boolean) => {
    try {
      if (isActive) {
        await apiFetch(`/api/events/subscriptions/${id}/stop`, {
          method: "POST",
        });
      } else {
        await apiFetch(`/api/events/subscriptions/${id}/start`, {
          method: "POST",
        });
      }
      await loadAll();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "구독 상태 변경 실패";
      alert(msg);
    }
  };

  const connectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const socket = io(apiBase, {
      transports: ["websocket"],
    });
    socket.on("connect", () => setWsConnected(true));
    socket.on("disconnect", () => setWsConnected(false));
    socket.on("event", (evt: CollectedEvent) => {
      setLastEvent(evt);
      setEvents((prev) => [evt, ...prev].slice(0, 50));
    });
    socketRef.current = socket;
  };

  useEffect(() => {
    const storedAccess = localStorage.getItem("accessToken");
    const storedRefresh = localStorage.getItem("refreshToken");
    if (storedAccess) setAccessToken(storedAccess);
    if (storedRefresh && !storedAccess) {
      refreshToken();
    }
    loadAll();
    connectSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 체인 목록 로드 후 기본 선택값 설정
  useEffect(() => {
    if (chains.length && !subForm.chainId) {
      setSubForm((prev) => ({ ...prev, chainId: String(chains[0].id) }));
    }
  }, [chains, subForm.chainId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase text-slate-400">Event Collector</p>
            <h1 className="text-xl font-semibold">Blockchain Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 rounded-full ${
                wsConnected ? "bg-emerald-400" : "bg-slate-500"
              }`}
              title={
                wsConnected ? "WebSocket Connected" : "WebSocket Disconnected"
              }
            />
            {walletAddress ? (
              <div className="rounded-full bg-slate-800 px-3 py-1 text-sm">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
              >
                지갑 로그인
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-3">
        <section className="col-span-2 grid gap-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard title="총 체인" value={stats?.totalChains ?? 0} />
            <StatCard title="총 구독" value={stats?.totalSubscriptions ?? 0} />
            <StatCard title="총 이벤트" value={stats?.totalEvents ?? 0} />
          </div>

          <Card title="실시간 이벤트 (최근 50개)">
            {loading && (
              <p className="text-sm text-slate-400">불러오는 중...</p>
            )}
            {!events.length && !loading && (
              <p className="text-sm text-slate-400">
                수집된 이벤트가 없습니다.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{evt.eventName}</span>
                    <span>
                      #{evt.blockNumber} • {evt.chainId}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-amber-100">
                    tx: {evt.transactionHash.slice(0, 10)}...
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-xs text-slate-200">
                    {JSON.stringify(evt.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <aside className="grid gap-6">
          <Card title="체인 추가">
            <FormRow
              label="Name"
              value={chainForm.name}
              onChange={(v) => setChainForm({ ...chainForm, name: v })}
              placeholder="Ethereum Mainnet"
            />
            <FormRow
              label="RPC URL"
              value={chainForm.rpcUrl}
              onChange={(v) => setChainForm({ ...chainForm, rpcUrl: v })}
              placeholder="https://..."
            />
            <FormRow
              label="Chain ID"
              type="number"
              value={String(chainForm.chainId)}
              onChange={(v) =>
                setChainForm({ ...chainForm, chainId: Number(v || 1) })
              }
            />
            <button
              onClick={addChain}
              className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
            >
              체인 등록
            </button>
          </Card>

          <Card title="이벤트 구독 추가">
            <SelectRow
              label="Chain"
              value={subForm.chainId}
              onChange={(v) => setSubForm({ ...subForm, chainId: v })}
              options={chains.map((c) => ({
                value: String(c.id),
                label: `${c.name} (#${c.chainId})`,
              }))}
              placeholder="체인을 선택하세요"
              disabled={!chains.length}
            />
            <FormRow
              label="Contract"
              value={subForm.contractAddress}
              onChange={(v) => setSubForm({ ...subForm, contractAddress: v })}
              placeholder="0x..."
            />
            <FormRow
              label="Event Name"
              value={subForm.eventName}
              onChange={(v) => setSubForm({ ...subForm, eventName: v })}
              placeholder="Transfer"
            />
            <FormRow
              label="Description (optional)"
              value={subForm.description}
              onChange={(v) => setSubForm({ ...subForm, description: v })}
              placeholder="예: ERC20 Transfer 이벤트 구독"
            />
            <FormRow
              label="ABI (JSON)"
              value={subForm.abi}
              onChange={(v) => setSubForm({ ...subForm, abi: v })}
              placeholder='[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"}]'
              multiline
            />
            <FormRow
              label="From Block (옵션)"
              value={subForm.fromBlock}
              onChange={(v) => setSubForm({ ...subForm, fromBlock: v })}
              placeholder="18000000"
              type="number"
            />
            <button
              onClick={addSubscription}
              className="mt-3 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-400"
            >
              구독 등록
            </button>
          </Card>

          <Card title="상태">
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>API</span>
                <span className="text-slate-100">{apiBase}</span>
              </div>
              <div className="flex justify-between">
                <span>WebSocket</span>
                <span
                  className={
                    wsConnected ? "text-emerald-300" : "text-slate-400"
                  }
                >
                  {wsConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              {lastEvent && (
                <div className="mt-3 rounded border border-slate-800 bg-slate-900 p-2">
                  <div className="text-xs text-slate-400">최근 이벤트</div>
                  <div className="text-sm text-slate-100">
                    {lastEvent.eventName}
                  </div>
                  <div className="text-xs text-slate-400">
                    #{lastEvent.blockNumber} • {lastEvent.chainId}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </aside>
      </main>

      <section className="mx-auto max-w-6xl px-6 pb-10">
        <Card title="체인 목록">
          <div className="grid gap-3 md:grid-cols-2">
            {chains.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-slate-800 bg-slate-900 p-3"
              >
                <div className="flex items-center justify-between text-sm font-semibold text-slate-100">
                  <span>{c.name}</span>
                  <span className="text-xs text-slate-400">#{c.chainId}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">{c.id}</div>
                <div className="mt-1 text-xs text-slate-500 truncate">
                  {c.rpcUrl}
                </div>
              </div>
            ))}
            {!chains.length && (
              <p className="text-sm text-slate-400">등록된 체인이 없습니다.</p>
            )}
          </div>
        </Card>

        <Card title="구독 목록">
          <div className="grid gap-3 md:grid-cols-2">
            {subscriptions.map((s) => (
              <div
                key={s.id}
                className={`rounded-lg border p-3 ${
                  s.isActive
                    ? "border-emerald-800 bg-slate-900"
                    : "border-slate-800 bg-slate-900/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-100">
                      <span>{s.eventName}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          s.isActive
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {s.isActive ? "활성" : "비활성"}
                      </span>
                    </div>
                    {s.description && (
                      <div className="mt-1 text-xs text-slate-300">
                        {s.description}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-slate-400">
                      {s.contractAddress.slice(0, 10)}...
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Chain ID: {s.chainId} • fromBlock:{" "}
                      {s.fromBlock ?? "latest"}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSubscription(s.id, s.isActive ?? true)}
                    className={`ml-3 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                      s.isActive
                        ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                        : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                    }`}
                  >
                    {s.isActive ? "OFF" : "ON"}
                  </button>
                </div>
              </div>
            ))}
            {!subscriptions.length && (
              <p className="text-sm text-slate-400">등록된 구독이 없습니다.</p>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/30">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-black/20">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
    </div>
  );
}

function FormRow({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-200">
      <span className="text-xs text-slate-400">{label}</span>
      {multiline ? (
        <textarea
          className="min-h-[96px] rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:border-emerald-500 focus:outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          type={type}
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:border-emerald-500 focus:outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-200">
      <span className="text-xs text-slate-400">{label}</span>
      <select
        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
