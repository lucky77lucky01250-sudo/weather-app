"use client";

import { useEffect, useMemo, useState } from "react";
import type { ForecastItem, WeatherApiResponse } from "./types";

const JST = "Asia/Tokyo";

function dateKey(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString("sv-SE", {
    timeZone: JST,
  });
}

function formatDateLabel(key: string): { day: string; weekday: string } {
  const d = new Date(`${key}T00:00:00+09:00`);
  return {
    day: d.toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
      timeZone: JST,
    }),
    weekday: d.toLocaleDateString("ja-JP", { weekday: "short", timeZone: JST }),
  };
}

function formatHour(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString("ja-JP", {
    hour: "numeric",
    timeZone: JST,
  });
}

function iconUrl(icon: string, size: "2x" | "4x" = "2x"): string {
  return `https://openweathermap.org/img/wn/${icon}@${size}.png`;
}

type DaySummary = {
  key: string;
  items: ForecastItem[];
  tempMin: number;
  tempMax: number;
  popMax: number;
  icon: string;
  description: string;
};

function summarizeByDay(items: ForecastItem[]): DaySummary[] {
  const groups = new Map<string, ForecastItem[]>();
  for (const item of items) {
    const key = dateKey(item.dt);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => {
    // 日中(正午前後)のコマを代表アイコンにする
    const noon =
      group.find((i) => formatHour(i.dt).startsWith("12")) ??
      group[Math.floor(group.length / 2)];
    return {
      key,
      items: group,
      tempMin: Math.min(...group.map((i) => i.main.temp_min)),
      tempMax: Math.max(...group.map((i) => i.main.temp_max)),
      popMax: Math.max(...group.map((i) => i.pop)),
      icon: noon.weather[0].icon,
      description: noon.weather[0].description,
    };
  });
}

// 最高気温と降水確率から服装・傘のヒントを組み立てる
function suggestOutfit(day: DaySummary): string[] {
  const t = day.tempMax;
  const clothes =
    t >= 30
      ? "半袖＋帽子がおすすめ。熱中症に注意して、こまめに水分補給を"
      : t >= 25
        ? "半袖で快適に過ごせそう。日中は日差し対策を"
        : t >= 20
          ? "長袖シャツか薄手の半袖がちょうどいい気温です"
          : t >= 15
            ? "薄手の羽織りがあると安心です"
            : t >= 10
              ? "セーターやジャケットで防寒を"
              : t >= 5
                ? "コート＋マフラーでしっかり防寒を"
                : "厚手のコート・手袋・マフラーの完全防寒で";
  const pop = Math.round(day.popMax * 100);
  const rain =
    pop >= 50
      ? `降水確率${pop}%。傘を忘れずに ☂️`
      : pop >= 30
        ? `降水確率${pop}%。折りたたみ傘があると安心です`
        : "傘の心配はなさそうです";
  const tips = [clothes, rain];
  if (day.tempMax - day.tempMin >= 8) {
    tips.push("朝晩と日中の気温差が大きいので、脱ぎ着しやすい服装がおすすめ");
  }
  return tips;
}

// 5日間の最高/最低気温の推移を折れ線で描く
function TempChart({ days }: { days: DaySummary[] }) {
  if (days.length < 2) return null;
  const W = 600;
  const H = 200;
  const PX = 40;
  const PY = 30;
  const temps = days.flatMap((d) => [d.tempMax, d.tempMin]);
  const lo = Math.floor(Math.min(...temps)) - 2;
  const hi = Math.ceil(Math.max(...temps)) + 2;
  const x = (i: number) => PX + (i * (W - PX * 2)) / (days.length - 1);
  const y = (t: number) => PY + ((hi - t) * (H - PY * 2)) / (hi - lo);
  const line = (pick: (d: DaySummary) => number) =>
    days.map((d, i) => `${x(i)},${y(pick(d))}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="5日間の最高気温と最低気温の推移グラフ"
    >
      <polyline
        points={line((d) => d.tempMax)}
        fill="none"
        stroke="#f87171"
        strokeWidth="2.5"
      />
      <polyline
        points={line((d) => d.tempMin)}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="2.5"
      />
      {days.map((d, i) => (
        <g key={d.key}>
          <circle cx={x(i)} cy={y(d.tempMax)} r="4" fill="#f87171" />
          <circle cx={x(i)} cy={y(d.tempMin)} r="4" fill="#38bdf8" />
          <text
            x={x(i)}
            y={y(d.tempMax) - 10}
            textAnchor="middle"
            fontSize="13"
            fill="#fca5a5"
          >
            {Math.round(d.tempMax)}°
          </text>
          <text
            x={x(i)}
            y={y(d.tempMin) + 20}
            textAnchor="middle"
            fontSize="13"
            fill="#7dd3fc"
          >
            {Math.round(d.tempMin)}°
          </text>
          <text
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="12"
            fill="#94a3b8"
          >
            {formatDateLabel(d.key).day}
          </text>
        </g>
      ))}
    </svg>
  );
}

const FAVORITES_KEY = "weather-favorites";

export default function Home() {
  const [cityInput, setCityInput] = useState("");
  const [data, setData] = useState<WeatherApiResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]"));
    } catch {
      // 壊れたデータは無視して空から始める
    }
  }, []);

  function saveFavorites(next: string[]) {
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  }

  async function fetchWeather(params: URLSearchParams) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weather?${params}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "取得に失敗しました");
      }
      setData(json);
      setSelectedDay(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function searchCity(e: React.FormEvent) {
    e.preventDefault();
    const city = cityInput.trim();
    if (!city) return;
    fetchWeather(new URLSearchParams({ city }));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("このブラウザは位置情報に対応していません");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        fetchWeather(
          new URLSearchParams({
            lat: String(pos.coords.latitude),
            lon: String(pos.coords.longitude),
          })
        ),
      () => {
        setLoading(false);
        setError("位置情報を取得できませんでした。都市名で検索してください");
      }
    );
  }

  // 初回は東京を表示
  useEffect(() => {
    fetchWeather(new URLSearchParams({ city: "Tokyo" }));
  }, []);

  const days = useMemo(
    () => (data ? summarizeByDay(data.forecast.list) : []),
    [data]
  );
  const activeDay = days.find((d) => d.key === selectedDay) ?? days[0] ?? null;

  const isFavorite = data ? favorites.includes(data.locationName) : false;

  function toggleFavorite() {
    if (!data) return;
    saveFavorites(
      isFavorite
        ? favorites.filter((f) => f !== data.locationName)
        : [...favorites, data.locationName]
    );
  }

  function removeFavorite(name: string) {
    saveFavorites(favorites.filter((f) => f !== name));
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <h1 className="text-center text-3xl font-bold tracking-tight">
        ☀️ 天気予報アプリ
      </h1>
      <p className="mt-1 text-center text-sm text-slate-400">
        都市名を入力するか、現在地から天気を調べられます
      </p>

      <form onSubmit={searchCity} className="mt-6 flex gap-2">
        <input
          type="text"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          placeholder="都市名（例: 大阪、Sapporo、New York）"
          className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-sky-500 px-5 py-2.5 font-semibold text-white transition hover:bg-sky-400 disabled:opacity-50"
        >
          検索
        </button>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={loading}
          className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
          title="現在地の天気を表示"
        >
          📍 現在地
        </button>
      </form>

      {favorites.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-400">⭐ お気に入り:</span>
          {favorites.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 pl-3 text-sm"
            >
              <button
                onClick={() => fetchWeather(new URLSearchParams({ city: name }))}
                disabled={loading}
                className="py-1 text-amber-200 transition hover:text-amber-100 disabled:opacity-50"
              >
                {name}
              </button>
              <button
                onClick={() => removeFavorite(name)}
                className="rounded-full px-2 py-1 text-slate-400 transition hover:text-red-300"
                title={`${name}をお気に入りから削除`}
                aria-label={`${name}をお気に入りから削除`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </p>
      )}

      {loading && (
        <p className="mt-8 text-center text-slate-400">読み込み中...</p>
      )}

      {data && !loading && (
        <>
          {/* 現在の天気 */}
          <section className="mt-6 rounded-2xl border border-slate-700 bg-gradient-to-br from-sky-900/60 to-slate-800/60 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-300">
                {data.locationName} の現在の天気
              </h2>
              <button
                onClick={toggleFavorite}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  isFavorite
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25"
                    : "border-slate-600 text-slate-300 hover:border-amber-400/60 hover:text-amber-200"
                }`}
              >
                {isFavorite ? "★ 登録済み" : "☆ お気に入りに追加"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <img
                src={iconUrl(data.current.weather[0].icon, "4x")}
                alt={data.current.weather[0].description}
                width={100}
                height={100}
              />
              <div>
                <p className="text-5xl font-bold">
                  {Math.round(data.current.main.temp)}
                  <span className="text-2xl font-normal text-slate-300">℃</span>
                </p>
                <p className="mt-1 text-lg text-slate-200">
                  {data.current.weather[0].description}
                </p>
              </div>
              <dl className="ml-auto grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-slate-400">体感温度</dt>
                <dd className="text-right font-medium">
                  {Math.round(data.current.main.feels_like)}℃
                </dd>
                <dt className="text-slate-400">湿度</dt>
                <dd className="text-right font-medium">
                  {data.current.main.humidity}%
                </dd>
                <dt className="text-slate-400">風速</dt>
                <dd className="text-right font-medium">
                  {data.current.wind.speed} m/s
                </dd>
              </dl>
            </div>
          </section>

          {/* 日付選択 */}
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-slate-300">
              📅 日付を選んで予報を見る
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {days.map((d) => {
                const label = formatDateLabel(d.key);
                const active = activeDay?.key === d.key;
                return (
                  <button
                    key={d.key}
                    onClick={() => setSelectedDay(d.key)}
                    className={`rounded-xl border p-2 text-center transition ${
                      active
                        ? "border-sky-400 bg-sky-500/20"
                        : "border-slate-700 bg-slate-800/60 hover:border-slate-500"
                    }`}
                  >
                    <p className="text-sm font-semibold">{label.day}</p>
                    <p className="text-xs text-slate-400">({label.weekday})</p>
                    <img
                      src={iconUrl(d.icon)}
                      alt={d.description}
                      width={44}
                      height={44}
                      className="mx-auto"
                    />
                    <p className="text-xs">
                      <span className="text-red-300">
                        {Math.round(d.tempMax)}°
                      </span>
                      {" / "}
                      <span className="text-sky-300">
                        {Math.round(d.tempMin)}°
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-sky-200">
                      ☔ {Math.round(d.popMax * 100)}%
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 気温推移グラフ */}
          <section className="mt-6 rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
            <h2 className="text-lg font-semibold text-slate-300">
              📈 気温の推移（
              <span className="text-red-300">最高</span>・
              <span className="text-sky-300">最低</span>）
            </h2>
            <div className="mt-2">
              <TempChart days={days} />
            </div>
          </section>

          {/* 服装のヒント */}
          {activeDay && (
            <section className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
              <h2 className="text-lg font-semibold text-emerald-200">
                👕 {formatDateLabel(activeDay.key).day}（
                {formatDateLabel(activeDay.key).weekday}）の服装のヒント
              </h2>
              <ul className="mt-2 space-y-1.5 text-slate-200">
                {suggestOutfit(activeDay).map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span aria-hidden="true">・</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 選択日の詳細（3時間ごと） */}
          {activeDay && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold text-slate-300">
                {formatDateLabel(activeDay.key).day}（
                {formatDateLabel(activeDay.key).weekday}）の3時間ごとの予報
              </h2>
              <div className="mt-3 overflow-x-auto">
                <div className="flex min-w-max gap-2 pb-2">
                  {activeDay.items.map((item) => (
                    <div
                      key={item.dt}
                      className="w-24 shrink-0 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center"
                    >
                      <p className="text-sm text-slate-400">
                        {formatHour(item.dt)}
                      </p>
                      <img
                        src={iconUrl(item.weather[0].icon)}
                        alt={item.weather[0].description}
                        width={44}
                        height={44}
                        className="mx-auto"
                      />
                      <p className="font-semibold">
                        {Math.round(item.main.temp)}℃
                      </p>
                      <p className="mt-1 text-xs text-sky-200">
                        ☔ {Math.round(item.pop * 100)}%
                      </p>
                      <p className="text-xs text-slate-400">
                        湿度 {item.main.humidity}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <p className="mt-8 text-center text-xs text-slate-500">
            データ提供: OpenWeatherMap（5日間 / 3時間ごと予報）
          </p>
        </>
      )}
    </main>
  );
}
