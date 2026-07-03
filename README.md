# 天気予報アプリ

OpenWeatherMap API と連携した天気予報 Web アプリです。都市名検索・現在地取得に対応し、日付を選んで 5 日間の予報を切り替えて確認できます。

## 機能

- 任意の都市（日本語・英語どちらでも検索可）または現在地の天気を表示
- 現在の天気：気温・体感温度・天気・湿度・風速
- 5 日間の予報から日付を選択 → その日の 3 時間ごとの気温・天気・降水確率・湿度を表示
- 日別サマリー：最高/最低気温・降水確率・代表天気アイコン

## 技術構成

- Next.js (App Router) + TypeScript + Tailwind CSS
- OpenWeatherMap API（Geocoding / Current Weather / 5 Day Forecast）
- API キーはサーバー側の Route Handler (`app/api/weather/route.ts`) からのみ使用し、クライアントには公開しない

## セットアップ

```bash
npm install
```

[OpenWeatherMap](https://openweathermap.org/api) で無料の API キーを取得し、プロジェクト直下に `.env.local` を作成：

```
OPENWEATHER_API_KEY=あなたのAPIキー
```

開発サーバーを起動：

```bash
npm run dev
```

http://localhost:3000 で確認できます。

## デプロイ（Vercel）

Vercel のプロジェクト設定 → Environment Variables に `OPENWEATHER_API_KEY` を登録してデプロイします。
