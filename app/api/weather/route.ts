import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.openweathermap.org";

type GeoResult = {
  name: string;
  local_names?: Record<string, string>;
  lat: number;
  lon: number;
  country: string;
};

// OWMの曖昧マッチ対策: 検索語と名前が一致する候補を優先する
// （例: "Osaka" の先頭候補が Orsk(ロシア) になることがある）
// 日本語の検索語は中国の類似地名に誤マッチしやすいため日本の候補を優先する
// （例: 「仙台」→ Xiantai(中国)、「那覇」→ Naba(中国)）
function pickBestMatch(
  results: GeoResult[],
  query: string,
  preferJapan: boolean
): GeoResult {
  const q = query.toLowerCase();
  const exact = results.filter(
    (r) =>
      r.name.toLowerCase() === q ||
      Object.values(r.local_names ?? {}).some((n) => n.toLowerCase() === q)
  );
  const pool = exact.length > 0 ? exact : results;
  if (preferJapan) {
    const jp =
      pool.find((r) => r.country === "JP") ??
      results.find((r) => r.country === "JP");
    if (jp) return jp;
  }
  return pool[0];
}

async function geocode(
  query: string,
  apiKey: string
): Promise<GeoResult[] | null> {
  const res = await fetch(
    `${API_BASE}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`
  );
  if (!res.ok) {
    console.error(
      `Geocoding API error: status=${res.status} body=${await res.text()}`
    );
    return null;
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "サーバーにAPIキーが設定されていません" },
      { status: 500 }
    );
  }

  const { searchParams } = request.nextUrl;
  const city = searchParams.get("city");
  let lat = searchParams.get("lat");
  let lon = searchParams.get("lon");
  let locationName = "";

  if (city) {
    const isJapaneseQuery = /[぀-ヿ一-鿿]/.test(city);
    let geo = await geocode(city, apiKey);
    if (geo === null) {
      return NextResponse.json(
        { error: "都市の検索に失敗しました" },
        { status: 502 }
      );
    }
    // 「札幌」「京都」等は日本の候補が出ないため「〜市」を付けて再検索する
    if (
      isJapaneseQuery &&
      !geo.some((r) => r.country === "JP") &&
      !/[市区町村]$/.test(city)
    ) {
      const retry = await geocode(`${city}市`, apiKey);
      if (retry && retry.some((r) => r.country === "JP")) {
        geo = retry;
      }
    }
    if (geo.length === 0) {
      return NextResponse.json(
        { error: `「${city}」が見つかりませんでした。都市名を確認してください` },
        { status: 404 }
      );
    }
    const best = pickBestMatch(geo, city, isJapaneseQuery);
    lat = String(best.lat);
    lon = String(best.lon);
    locationName = best.local_names?.ja ?? best.name;
  }

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "都市名または位置情報を指定してください" },
      { status: 400 }
    );
  }

  const common = `lat=${lat}&lon=${lon}&units=metric&lang=ja&appid=${apiKey}`;
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${API_BASE}/data/2.5/weather?${common}`),
    fetch(`${API_BASE}/data/2.5/forecast?${common}`),
  ]);

  if (!currentRes.ok || !forecastRes.ok) {
    console.error(
      `Weather API error: current=${currentRes.status} forecast=${forecastRes.status}`
    );
    return NextResponse.json(
      { error: "天気情報の取得に失敗しました" },
      { status: 502 }
    );
  }

  const current = await currentRes.json();
  const forecast = await forecastRes.json();

  return NextResponse.json({
    locationName: locationName || current.name,
    current,
    forecast,
  });
}
