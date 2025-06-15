export const createSideMetricData = (rawData, fieldConfigs) => {
  const formatters = {
    percent: (val) => `${Math.round(val)}%`,
    currency: (val) => (val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val}`),
    number: (val) => val.toString(),
  };

  return fieldConfigs.map((config) => {
    const {
      id,
      field,
      title,
      type = "number",
      range = [0, 100],
      labels = [range[0].toString(), range[1].toString()],
      average,
      averageLabel,
      transform = (val) => parseFloat(val),
    } = config;

    const currentValue = Math.round(transform(rawData[field]));
    const formatter = formatters[type] || formatters.number;

    return {
      id,
      title,
      currentValueDisplay: formatter(currentValue),
      currentValue,
      minValue: range[0],
      maxValue: range[1],
      minLabel: labels[0],
      maxLabel: labels[1],
      averageValue: average,
      ...(averageLabel && { averageLabel }),
    };
  });
};
