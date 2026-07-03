import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.openweathermap.org";

type GeoResult = {
  name: string;
  local_names?: { ja?: string };
  lat: number;
  lon: number;
  country: string;
};

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
      `${API_BASE}/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`
    );
    if (!geoRes.ok) {
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
    lat = String(geo[0].lat);
    lon = String(geo[0].lon);
    locationName = geo[0].local_names?.ja ?? geo[0].name;
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
