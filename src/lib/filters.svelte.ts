class DataFilters {
  /** county code, e.g. "000150" */
  county = $state("");
  /** year start, 0: null */
  yearStart = $state(0);
  /** year end, 0: null */
  yearEnd = $state(0);
  /** minimum year range span */
  minYearRangeSpan = $state(4);
  /** percentile, 0: null; 1: 0-20, 2: 20-40, 3: 40-60, 4: 60-80, 5: 80-100 */
  quantile = $state(0);
  /** 0: Number of closed church, 1: Density of closed church: per 100k population, 2: Density of closed church: per sqkm */
  metric = $state(0);
  metrics = [
    { label: "Number of closed church", description: "", value: 0 },
    {
      label: "Density of closed church: per 100k population",
      description: "Density of closed church: per 100k population",
      value: 1,
    },
    {
      label: "Density of closed church: per sqkm",
      description: "Density of closed church: per sqkm",
      value: 2,
    },
  ] as { label: string; description: string; value: 0 | 1 | 2 }[];

  setCounty = (county: string) => {
    this.county = county;
  };

  clearCounty = () => {
    this.county = "";
  };

  setYearRange = (start: number, end: number) => {
    // make sure the start year is less than the end year
    if (start > end) {
      [start, end] = [end, start];
    }
    // make sure the year range is at least the minimum year range span
    if (end - start < this.minYearRangeSpan) {
      end = start + this.minYearRangeSpan;
    }
    this.yearStart = start;
    this.yearEnd = end;
  };

  clearYearRange = () => {
    this.yearStart = 0;
    this.yearEnd = 0;
  };

  setMetric = (metric: 0 | 1 | 2) => {
    this.metric = metric;
  };

  setQuantile = (quantile: 0 | 1 | 2 | 3 | 4 | 5) => {
    this.quantile = quantile;
  };
}

export const dataFilters = new DataFilters();
