export const bucketFor = (from: Date, to: Date, maxPoints: number): string => {
  const rangeSeconds = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 1000));
  const seconds = Math.max(1, Math.ceil(rangeSeconds / maxPoints));
  return `${seconds} seconds`;
};
