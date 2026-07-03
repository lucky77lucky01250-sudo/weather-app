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
function pickBestMatch(results: GeoResult[], query: string): GeoResult {
  const q = query.toLowerCase();
  return (
    results.find(
      (r) =>
        r.name.toLowerCase() === q ||
        Object.values(r.local_names ?? {}).some((n) => n.toLowerCase() === q)
    ) ?? results[0]
  );
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
    const geoRes = await fetch(
      `${API_BASE}/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=5&appid=${apiKey}`
    );
    if (!geoRes.ok) {
      console.error(
        `Geocoding API error: status=${geoRes.status} body=${await geoRes.text()}`
      );
      return NextResponse.json(
        { error: "都市の検索に失敗しました" },
        { status: 502 }
      );
    }
    const geo: GeoResult[] = await geoRes.json();
    if (geo.length === 0) {
      return NextResponse.json(
        { error: `「${city}」が見つかりませんでした。都市名を確認してください` },
        { status: 404 }
      );
    }
    const best = pickBestMatch(geo, city);
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
