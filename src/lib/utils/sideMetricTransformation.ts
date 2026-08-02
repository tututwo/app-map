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

function transformValue(rawValue: unknown, config: SideMetricFieldConfig): number | undefined {
  if (rawValue === undefined || rawValue === null || rawValue === "") return undefined;

  try {
    const transformed = config.transform
      ? config.transform(rawValue)
      : Number.parseFloat(String(rawValue));
    return Number.isFinite(transformed) ? Math.round(transformed) : undefined;
  } catch {
    return undefined;
  }
}

export function createSideMetricData(
  rawData: RawSideMetricData,
  fieldConfigs: readonly SideMetricFieldConfig[]
): SideMetricStatistic[] {
  if (!rawData || Array.isArray(rawData)) return [];

  return fieldConfigs.flatMap((config) => {
    const currentValue = transformValue(rawData[config.field], config);
    if (currentValue === undefined) return [];

    const type = config.type === "currency" || config.type === "percent" ? config.type : "number";
    const minValue = config.range?.[0] ?? 0;
    const maxValue = config.range?.[1] ?? 100;
    const minLabel = config.labels?.[0] ?? minValue.toString();
    const maxLabel = config.labels?.[1] ?? maxValue.toString();

    return [
      {
        id: config.id,
        title: config.title,
        currentValueDisplay: formatters[type](currentValue),
        currentValue,
        minValue,
        maxValue,
        minLabel,
        maxLabel,
        ...(config.average !== undefined ? { averageValue: config.average } : {}),
        ...(config.averageLabel ? { averageLabel: config.averageLabel } : {}),
      },
    ];
  });
}
