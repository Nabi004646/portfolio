import { cp, mkdir, access } from 'node:fs/promises';

await mkdir('public/vision', { recursive: true });
await cp('node_modules/@mediapipe/tasks-vision/wasm', 'public/vision/wasm', { recursive: true });
try {
  await access('public/vision/blaze_face_short_range.tflite');
} catch {
  throw new Error('Face model missing. Run: node scripts/download-model.mjs');
}
