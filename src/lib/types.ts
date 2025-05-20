type DataPoint = {
  /** Geographic identifier */
  geoid: string;
  /** State */
  state: string;
  /** Area size */
  tarea: number;
  /** Spatial level of the data */
  spatial_level: string;
  /** Year */
  year: number;
  /** Number of church closings */
  close: number;
  /** Persistence of institutions */
  persistence: number;
  /** Rate of church closings per 100,000 population */
  close_r_100k: number;
  /** Rate of church closings per square kilometer */
  close_r_sqkm: number;
  /** Persistence rate per 100,000 population */
  persistence_r_100k: number;
  /** Persistence rate per square kilometer */
  persistence_r_sqkm: number;

  /** Number of individuals with median income */
  n_medincome: number;
  /** Total population */
  n_pop_total: number;
  /** Number of individuals identifying as Black */
  n_pop_black: number;
  /** Number of individuals identifying as Hispanic */
  n_pop_hisp: number;
  /** Percentage of population identifying as Black */
  p_pct_black: number;
  /** Percentage of population identifying as Hispanic */
  p_pct_hisp: number;
  /** Percentage of population renting */
  p_renter: number;
  /** Percentage of population living in poverty */
  p_poverty: number;
  /** Percentage of population unemployed */
  p_unemp: number;
  /** Percentage of population living in overcrowded conditions */
  p_overcrowding: number;
  /** Number of individuals with median rent */
  n_med_rent: number;
  /** Percentage of population with mobility limitations */
  p_mobility: number;
  /** Number of individuals aged 25 and older */
  n_pop_25: number;
  /** Number of individuals aged 65 and older */
  n_pop_65p: number;
  /** Percentage of population aged 65 and older */
  p_pct_65p: number;
  /** Number of individuals with at least a high school education */
  n_edu_yes_hs: number;
  /** Number of individuals without a high school education */
  n_edu_no_hs: number;
  /** Percentage of population without a high school education */
  p_edu_no_hs: number;
  /** Number of community health centers */
  n_commhlthcntr: number;
  /** Rate of community health centers per 100,000 population */
  r_commhlthcntr_100k: number;
  /** Gini index */
  i_gini: number;
  /** Population density per square kilometer */
  d_pop_sqkm: number;
};

async function fetchChartsData(from: number, to: number, geoid?: string) {
  const resp = await fetch("charts_data_url", {
    body: JSON.stringify({ from, to, geoid }),
  });

  const array_for_year_range: DataPoint[] = await resp.json();
  console.log(array_for_year_range);
}

type CountyDataPoint = {
  geoid: string;
  /** Number of church closings */
  close: number;
  /** Rate of church closings per 100,000 population */
  close_r_100k: number;
  /** Rate of church closings per square kilometer */
  close_r_sqkm: number;
};

async function fetchMapData(from: number, to: number) {
  const resp = await fetch("map_data_url", {
    body: JSON.stringify({
      from: 2003,
      to: 2011,
    }),
  });

  const array_of_3000_counties: CountyDataPoint[] = await resp.json();
  console.log(array_of_3000_counties);
}
