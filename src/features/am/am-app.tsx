import { useState } from "react";
import { ArrowUpRight, LogOut, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ClientStorefront = {
  id: string;
  name: string;
  plan: string;
  city: string;
  status: "active" | "draft";
  orders: number;
};

const CLIENTS: ClientStorefront[] = [
  { id: "kimchi", name: "Kimchi Astana", plan: "Бизнес", city: "Астана", status: "active", orders: 1280 },
  { id: "tang", name: "Tang Beef Noodles", plan: "Старт", city: "Алматы", status: "active", orders: 642 },
  { id: "sekundi", name: "Sekundi Coffee", plan: "Бизнес", city: "Астана", status: "active", orders: 415 },
  { id: "prada", name: "Prada Pizza", plan: "Старт", city: "Шымкент", status: "draft", orders: 0 },
  { id: "brzo", name: "Brzo Burgers", plan: "Бизнес", city: "Караганда", status: "active", orders: 938 },
  { id: "moderno", name: "Moderno Bistro", plan: "Старт", city: "Алматы", status: "draft", orders: 0 },
];

function avatarTone(id: string) {
  const tones = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-amber-100 text-amber-700",
    "bg-emerald-100 text-emerald-700",
    "bg-rose-100 text-rose-700",
    "bg-indigo-100 text-indigo-700",
  ];
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return tones[sum % tones.length];
}

function ClientCard({ client, onOpen }: { client: ClientStorefront; onOpen: () => void }) {
  return (
    <div className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black",
            avatarTone(client.id),
          )}
        >
          {client.name.slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-zinc-950">{client.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {client.city} · {client.plan}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold",
            client.status === "active"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-zinc-100 text-zinc-500",
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              client.status === "active" ? "bg-emerald-500" : "bg-zinc-400",
            )}
          />
          {client.status === "active" ? "Активна" : "Черновик"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {client.status === "active" ? (
            <>
              <span className="font-bold text-zinc-900">{client.orders.toLocaleString("ru-RU")}</span>{" "}
              заказов за месяц
            </>
          ) : (
            "Витрина ещё не запущена"
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 transition hover:text-blue-700"
        >
          Открыть
          <ArrowUpRight size={15} />
        </button>
      </div>
    </div>
  );
}

export function AMApp({ onExit }: { onExit: () => void }) {
  const [query, setQuery] = useState("");

  const filtered = CLIENTS.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex h-screen flex-col bg-zinc-50 text-zinc-950">
      {/* Топбар AM — полностью отдельный от админки витрины */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">
            T
          </div>
          <div className="flex items-center gap-2">
            <span className="font-black tracking-tight">TASKO</span>
            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-700">
              Account Manager
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-sm text-muted-foreground sm:block">Айгерим · AM</div>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <LogOut size={16} />
            К витрине
          </button>
        </div>
      </header>

      {/* Контент */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Витрины клиентов</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Внутреннее рабочее пространство команды: список, переключение и запуск витрин.
              </p>
            </div>
            <Button className="shrink-0 font-bold">
              <Plus size={16} />
              Новая витрина
            </Button>
          </div>

          <div className="relative mt-6 max-w-md">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию витрины…"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((client) => (
              <ClientCard key={client.id} client={client} onOpen={onExit} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-white py-16 text-center text-sm text-muted-foreground">
              Ничего не найдено по запросу «{query}»
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
