// Esempio base React + MediaPipe FaceMesh per annotazioni sul volto con selezione webcam

'use client';

import { useEffect, useRef, useState } from 'react';
import CameraUtils from '@mediapipe/camera_utils';
const Camera = CameraUtils.Camera;

export default function FaceAnnotator() {
  const videoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const annotationCanvasRef = useRef(null);
  const [annotations, setAnnotations] = useState([]);
  const [landmarks, setLandmarks] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoDevices);
      setSelectedDeviceId((prev) => prev || videoDevices[0]?.deviceId || null);
    });
  }, [isClient]);

  useEffect(() => {
    if (!isClient || !selectedDeviceId) return;

    const initFaceMesh = async () => {
      const { FaceMesh } = await import('@mediapipe/face_mesh');

      const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults((results) => {
        const canvas = faceCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
          const faceLandmarks = results.multiFaceLandmarks[0];
          setLandmarks(faceLandmarks);

          for (const point of faceLandmarks) {
            const x = point.x * canvas.width;
            const y = point.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, 2 * Math.PI);
            ctx.fillStyle = '#00FF00';
            ctx.fill();
          }
        }
        ctx.restore();
      });

      if (cameraRef.current) {
        cameraRef.current.stop();
      }

      if (videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDeviceId } },
        });

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const newCamera = new Camera(videoRef.current, {
          onFrame: async () => {
            await faceMesh.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });

        cameraRef.current = newCamera;
        newCamera.start();
      }
    };

    initFaceMesh();
  }, [isClient, selectedDeviceId]);

  const handleCanvasClick = (e) => {
    if (!landmarks) return;
    const rect = annotationCanvasRef.current.getBoundingClientRect();
    const xClick = e.clientX - rect.left;
    const yClick = e.clientY - rect.top;

    let closestIndex = 0;
    let minDist = Infinity;

    landmarks.forEach((point, index) => {
      const x = point.x * 640;
      const y = point.y * 480;
      const dist = Math.sqrt((x - xClick) ** 2 + (y - yClick) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closestIndex = index;
      }
    });

    const note = prompt('Inserisci nota:');
    if (!note) return;
    setAnnotations([...annotations, { landmarkIndex: closestIndex, note }]);
  };

  useEffect(() => {
    if (!isClient || !landmarks) return;
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotations.forEach(({ landmarkIndex, note }) => {
      const point = landmarks[landmarkIndex];
      if (!point) return;
      const x = point.x * 640;
      const y = point.y * 480;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
      ctx.fillText(note, x + 8, y);
    });
  }, [annotations, landmarks, isClient]);

  if (!isClient) return null;

  return (
    <div className="flex flex-col items-center">
      <select
        className="mb-2 border border-gray-300 p-1"
        onChange={(e) => setSelectedDeviceId(e.target.value)}
        value={selectedDeviceId || ''}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Camera ${device.deviceId}`}
          </option>
        ))}
      </select>

      <div className="relative w-[640px] h-[480px]">
        <video ref={videoRef} className="hidden" width="640" height="480" autoPlay playsInline muted></video>
        <canvas
          ref={faceCanvasRef}
          width="640"
          height="480"
          className="absolute top-0 left-0 z-0"
        />
        <canvas
          ref={annotationCanvasRef}
          width="640"
          height="480"
          className="absolute top-0 left-0 z-10"
          onClick={handleCanvasClick}
        />
      </div>
      <p className="mt-4 text-center">Clicca su un punto del volto per aggiungere un'annotazione.</p>
    </div>
  );
}