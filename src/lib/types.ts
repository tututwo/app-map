export interface BarSegment {
  range: string;
  color: string; // Tailwind background color class
  textColor?: string; // Tailwind text color class for text inside segment
  popupValue?: string; // Value for the popup above a segment
  markerText?: string; // Text below a segment
}
