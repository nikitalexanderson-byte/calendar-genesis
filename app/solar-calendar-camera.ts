export type SolarCamera = { x: number; y: number; size: number };
export const SOLAR_OVERVIEW: SolarCamera = { x: 0, y: 0, size: 5000 };
export function clampSolarCamera(camera: SolarCamera): SolarCamera {
  const size = Math.max(320, Math.min(5000, camera.size));
  return { size, x: Math.max(0, Math.min(5000 - size, camera.x)), y: Math.max(0, Math.min(5000 - size, camera.y)) };
}
export function fitSolarElement(box: { x: number; y: number; width: number; height: number }): SolarCamera {
  const size = Math.max(420, Math.max(box.width, box.height) * 1.25);
  return clampSolarCamera({ x: box.x + box.width / 2 - size / 2, y: box.y + box.height / 2 - size / 2, size });
}
export function zoomSolarCamera(camera: SolarCamera, factor: number): SolarCamera {
  const size = Math.max(320, Math.min(5000, camera.size * factor));
  return clampSolarCamera({ x: camera.x + (camera.size - size) / 2, y: camera.y + (camera.size - size) / 2, size });
}
