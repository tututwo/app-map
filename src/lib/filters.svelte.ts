class DataFilters {
  /** county code, e.g. "000150" */
  county = $state("");
  /** year start, 0: null */
  yearStart = $state(0);
  /** year end, 0: null */
  yearEnd = $state(0);
  /** minimum year range span */
  minYearRangeSpan = $state(4);
  /** 0: Number of closed church, 1: Density of closed church: per 100k population, 2: Density of closed church: per sqkm */
  metric = $state(0);
  metrics = [
    {
      label: "Number of closed church",
      description: "Number of closed churches",
      value: 0,
      colorKey: "closure",
      colorRange: ["#FEDFF0", "#E9A9CC", "#D476AA", "#C14288", "#B01169"],
      colorDomain: [0, 1],
    },
    {
      label: "Rate of closed churches per 10,000 population",
      description: "Persistence of open churches",
      colorKey: "closure_rate_per_10000",
      value: 1,
      colorRange: ["#FAE2C9", "#E9C39B", "#D9A671", "#CB8944", "#B96308"],
      colorDomain: [0, 1],
    },
    {
      label: "Persistence of open churches",
      description: "Persistence of open churches",
      colorKey: "persistence",
      value: 2,
      colorRange: ["#F1E0FD", "#CCADE3", "#A272C5", "#7836A7", "#5C168E"],
      colorDomain: [0, 1],
    },
  ] as {
    label: string;
    description: string;
    colorKey: string;
    value: 0 | 1 | 2;
    colorRange: string[];
    colorDomain: [number, number];
  }[];

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
}

export const dataFilters = new DataFilters();
