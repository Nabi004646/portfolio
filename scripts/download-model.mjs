import { mkdir, writeFile } from 'node:fs/promises';

const url = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
await mkdir('public/vision', { recursive: true });
const response = await fetch(url);
if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
const data = Buffer.from(await response.arrayBuffer());
if (data.length < 100000 || data.toString('ascii', 4, 8) !== 'TFL3') throw new Error('Unexpected model file.');
await writeFile('public/vision/blaze_face_short_range.tflite', data);
console.log(`Face model saved (${data.length} bytes).`);
