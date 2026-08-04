/**
 * Row shapes shared by the generated datasets, the remote functions that serve
 * them (data.remote.ts), and the components that render them.
 */

export interface MapDatum {
  geoid: string;
  name: string;
  closure: number;
  closure_rate_per_10000: number;
  persistence: number;
  reopening: number;
}

export interface LineDatum {
  year: number;
  close: number;
}

export interface StackedDatum {
  year: number;
  negative: number;
  neutral: number;
  positive: number;
}

export type SideMetricDatum = Record<string, string> & { geoid: string };
