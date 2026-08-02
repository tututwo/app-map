export type MapCaptureState =
  | { state: "loading"; revision: number }
  | { state: "ready"; revision: number }
  | { state: "error"; revision: number; message: string };

export function initialMapCaptureState(): MapCaptureState {
  return { state: "loading", revision: 0 };
}
