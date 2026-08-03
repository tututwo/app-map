import type { SideMetricFieldConfig, SideMetricValueType } from "$lib/config/sideMetrics";

export interface SideMetricStatistic {
  id: string;
  title: string;
  currentValueDisplay: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  minLabel: string;
  maxLabel: string;
  averageValue?: number;
  averageLabel?: string;
}

type RawSideMetricData = Readonly<Record<string, unknown>> | null | undefined;

const formatters: Record<SideMetricValueType, (value: number) => string> = {
  percent: (value) => `${value}%`,
  currency: (value) => (value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`),
  number: (value) => value.toString(),
};

function transformValue(rawValue: unknown): number | undefined {
  if (rawValue === undefined || rawValue === null || rawValue === "") return undefined;

  const parsed = Number.parseFloat(String(rawValue));
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

export function createSideMetricData(
  rawData: RawSideMetricData,
  fieldConfigs: readonly SideMetricFieldConfig[]
): SideMetricStatistic[] {
  if (!rawData || Array.isArray(rawData)) return [];

  return fieldConfigs.flatMap((config) => {
    const currentValue = transformValue(rawData[config.field]);
    if (currentValue === undefined) return [];

    return [
      {
        id: config.id,
        title: config.title,
        currentValueDisplay: formatters[config.type](currentValue),
        currentValue,
        minValue: config.range[0],
        maxValue: config.range[1],
        minLabel: config.labels[0],
        maxLabel: config.labels[1],
        ...(config.average !== undefined ? { averageValue: config.average } : {}),
        ...(config.averageLabel ? { averageLabel: config.averageLabel } : {}),
      },
    ];
  });
}
