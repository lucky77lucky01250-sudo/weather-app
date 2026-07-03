export type WeatherCondition = {
  id: number;
  main: string;
  description: string;
  icon: string;
};

export type CurrentWeather = {
  name: string;
  dt: number;
  weather: WeatherCondition[];
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  wind: { speed: number };
};

export type ForecastItem = {
  dt: number;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
  };
  weather: WeatherCondition[];
  pop: number;
};

export type ForecastResponse = {
  list: ForecastItem[];
  city: { name: string };
};

export type WeatherApiResponse = {
  locationName: string;
  current: CurrentWeather;
  forecast: ForecastResponse;
};
