export interface Forecast {
  id: string;
  year: number;
  month: number;
  target: number;
  actual: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForecastFormData {
  year: number;
  month: number;
  target?: number;
  actual?: number;
}

export interface ForecastSummary {
  year: number;
  totalTarget: number;
  totalActual: number;
  achievement: number;
  months: Forecast[];
}
