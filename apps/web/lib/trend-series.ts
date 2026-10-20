export type TrafficMetric = "total" | "upload" | "download";

export function trafficValue(point: { upload: number; download: number }, metric: TrafficMetric): number {
  return metric === "total" ? point.upload + point.download : point[metric];
}
