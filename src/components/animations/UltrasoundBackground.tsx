"use client";

import { useEffect, useRef, useCallback } from "react";

interface MuscleFiber {
  x: number;
  y: number;
  length: number;
  angle: number;
  thickness: number;
  depth: number;
  waveOffset: number;
}

interface TissueLayer {
  y: number;
  amplitude: number;
  frequency: number;
  phase: number;
  opacity: number;
}

export function UltrasoundBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const fibersRef = useRef<MuscleFiber[]>([]);
  const layersRef = useRef<TissueLayer[]>([]);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const scanLineRef = useRef<number>(0);

  const initElements = useCallback((width: number, height: number) => {
    const fibers: MuscleFiber[] = [];
    const fiberCount = Math.floor((width * height) / 8000);

    // Create muscle fibers distributed across the canvas
    for (let i = 0; i < fiberCount; i++) {
      fibers.push({
        x: Math.random() * width,
        y: Math.random() * height,
        length: 30 + Math.random() * 80,
        angle: Math.PI / 2 + (Math.random() - 0.5) * 0.5, // Mostly vertical like real muscle fibers
        thickness: 1 + Math.random() * 3,
        depth: Math.random(), // 0 = surface, 1 = deep
        waveOffset: Math.random() * Math.PI * 2,
      });
    }

    // Create tissue layers (fascia, tendons)
    const layers: TissueLayer[] = [];
    const layerCount = 5;
    for (let i = 0; i < layerCount; i++) {
      layers.push({
        y: (height / (layerCount + 1)) * (i + 1),
        amplitude: 10 + Math.random() * 20,
        frequency: 0.005 + Math.random() * 0.01,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.1 + Math.random() * 0.2,
      });
    }

    fibersRef.current = fibers;
    layersRef.current = layers;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      initElements(rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      timeRef.current += 0.016;
      scanLineRef.current = (scanLineRef.current + 0.5) % height;

      // Dark ultrasound background
      ctx.fillStyle = "rgb(5, 10, 15)";
      ctx.fillRect(0, 0, width, height);

      const mouse = mouseRef.current;
      const probeRadius = 180;
      const time = timeRef.current;

      // Draw subtle noise texture (ultrasound speckle)
      drawSpeckleNoise(ctx, width, height, time);

      // Draw tissue layers (fascia/connective tissue)
      drawTissueLayers(ctx, width, height, mouse, probeRadius, time);

      // Draw muscle fibers
      drawMuscleFibers(ctx, mouse, probeRadius, time);

      // Draw scanning beam effect at mouse position
      if (mouse.x > 0 && mouse.y > 0) {
        drawProbeEffect(ctx, mouse, probeRadius, height);
      }

      // Draw scan lines (CRT effect)
      drawScanLines(ctx, width, height);

      // Draw ultrasound UI overlay
      drawUIOverlay(ctx, width, height, mouse);

      animationRef.current = requestAnimationFrame(animate);
    };

    const drawSpeckleNoise = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      time: number
    ) => {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const noiseIntensity = 8;

      for (let i = 0; i < data.length; i += 16) {
        const noise = (Math.random() - 0.5) * noiseIntensity;
        const timeNoise = Math.sin(time * 2 + i * 0.001) * 2;
        data[i] = Math.max(0, Math.min(255, data[i] + noise + timeNoise));
        data[i + 1] = Math.max(
          0,
          Math.min(255, data[i + 1] + noise + timeNoise)
        );
        data[i + 2] = Math.max(
          0,
          Math.min(255, data[i + 2] + noise * 1.2 + timeNoise)
        );
      }
      ctx.putImageData(imageData, 0, 0);
    };

    const drawTissueLayers = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      mouse: { x: number; y: number },
      probeRadius: number,
      time: number
    ) => {
      layersRef.current.forEach((layer) => {
        ctx.beginPath();
        ctx.moveTo(0, layer.y);

        for (let x = 0; x < width; x += 2) {
          const wave =
            Math.sin(x * layer.frequency + layer.phase + time * 0.5) *
            layer.amplitude;
          const distToMouse = Math.sqrt(
            Math.pow(x - mouse.x, 2) + Math.pow(layer.y + wave - mouse.y, 2)
          );

          let y = layer.y + wave;

          // Intensify near mouse (probe reveals more detail)
          if (distToMouse < probeRadius) {
            const intensity = 1 - distToMouse / probeRadius;
            y += Math.sin(x * 0.05 + time * 3) * 5 * intensity;
          }

          ctx.lineTo(x, y);
        }

        const distToMouse = Math.abs(layer.y - mouse.y);
        const baseOpacity = layer.opacity;
        const mouseBoost =
          distToMouse < probeRadius
            ? (1 - distToMouse / probeRadius) * 0.4
            : 0;

        ctx.strokeStyle = `rgba(100, 180, 220, ${baseOpacity + mouseBoost})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw secondary echo line
        ctx.beginPath();
        ctx.moveTo(0, layer.y + 8);
        for (let x = 0; x < width; x += 2) {
          const wave =
            Math.sin(x * layer.frequency + layer.phase + time * 0.5) *
            (layer.amplitude * 0.6);
          ctx.lineTo(x, layer.y + 8 + wave);
        }
        ctx.strokeStyle = `rgba(60, 120, 160, ${(baseOpacity + mouseBoost) * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    };

    const drawMuscleFibers = (
      ctx: CanvasRenderingContext2D,
      mouse: { x: number; y: number },
      probeRadius: number,
      time: number
    ) => {
      fibersRef.current.forEach((fiber) => {
        const distToMouse = Math.sqrt(
          Math.pow(fiber.x - mouse.x, 2) + Math.pow(fiber.y - mouse.y, 2)
        );

        // Base visibility based on depth
        let visibility = 0.05 + (1 - fiber.depth) * 0.1;

        // Increase visibility near probe
        if (distToMouse < probeRadius) {
          const intensity = 1 - distToMouse / probeRadius;
          visibility += intensity * 0.6 * (1 - fiber.depth * 0.5);
        }

        // Fiber contraction animation
        const contraction =
          Math.sin(time * 2 + fiber.waveOffset) * 0.1 *
          (distToMouse < probeRadius
            ? 1 + (1 - distToMouse / probeRadius)
            : 1);

        const startX = fiber.x;
        const startY = fiber.y;
        const endX =
          fiber.x +
          Math.cos(fiber.angle) * fiber.length * (1 + contraction);
        const endY =
          fiber.y +
          Math.sin(fiber.angle) * fiber.length * (1 + contraction);

        // Draw fiber with gradient
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        const grayValue = 120 + (1 - fiber.depth) * 80;
        gradient.addColorStop(
          0,
          `rgba(${grayValue}, ${grayValue + 20}, ${grayValue + 40}, ${visibility * 0.5})`
        );
        gradient.addColorStop(
          0.5,
          `rgba(${grayValue + 40}, ${grayValue + 60}, ${grayValue + 80}, ${visibility})`
        );
        gradient.addColorStop(
          1,
          `rgba(${grayValue}, ${grayValue + 20}, ${grayValue + 40}, ${visibility * 0.5})`
        );

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        // Add slight wave to fiber
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const waveAmp = Math.sin(time * 3 + fiber.waveOffset) * 3;
        ctx.quadraticCurveTo(
          midX + Math.cos(fiber.angle + Math.PI / 2) * waveAmp,
          midY + Math.sin(fiber.angle + Math.PI / 2) * waveAmp,
          endX,
          endY
        );

        ctx.strokeStyle = gradient;
        ctx.lineWidth = fiber.thickness;
        ctx.lineCap = "round";
        ctx.stroke();

        // Draw bright spots (muscle striations)
        if (visibility > 0.3 && distToMouse < probeRadius * 0.7) {
          const striationCount = Math.floor(fiber.length / 15);
          for (let i = 1; i < striationCount; i++) {
            const t = i / striationCount;
            const sx = startX + (endX - startX) * t;
            const sy = startY + (endY - startY) * t;

            ctx.beginPath();
            ctx.arc(sx, sy, 1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200, 220, 240, ${visibility * 0.5})`;
            ctx.fill();
          }
        }
      });
    };

    const drawProbeEffect = (
      ctx: CanvasRenderingContext2D,
      mouse: { x: number; y: number },
      probeRadius: number,
      height: number
    ) => {
      // Ultrasound cone beam
      const coneWidth = probeRadius * 1.5;
      const gradient = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        probeRadius
      );
      gradient.addColorStop(0, "rgba(100, 200, 255, 0.15)");
      gradient.addColorStop(0.5, "rgba(60, 150, 200, 0.08)");
      gradient.addColorStop(1, "rgba(40, 100, 150, 0)");

      ctx.beginPath();
      ctx.moveTo(mouse.x, mouse.y);
      ctx.arc(mouse.x, mouse.y, probeRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Scanning lines radiating from probe
      const lineCount = 12;
      for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2;
        const lineLength = probeRadius * 0.8;

        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(
          mouse.x + Math.cos(angle) * lineLength,
          mouse.y + Math.sin(angle) * lineLength
        );
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.1 + Math.sin(timeRef.current * 5 + i) * 0.05})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Probe crosshair
      ctx.beginPath();
      ctx.moveTo(mouse.x - 10, mouse.y);
      ctx.lineTo(mouse.x + 10, mouse.y);
      ctx.moveTo(mouse.x, mouse.y - 10);
      ctx.lineTo(mouse.x, mouse.y + 10);
      ctx.strokeStyle = "rgba(100, 200, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawScanLines = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number
    ) => {
      // Horizontal scan lines
      ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
      for (let y = 0; y < height; y += 3) {
        ctx.fillRect(0, y, width, 1);
      }

      // Moving scan line
      const scanY = scanLineRef.current;
      const scanGradient = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
      scanGradient.addColorStop(0, "rgba(100, 200, 255, 0)");
      scanGradient.addColorStop(0.5, "rgba(100, 200, 255, 0.1)");
      scanGradient.addColorStop(1, "rgba(100, 200, 255, 0)");
      ctx.fillStyle = scanGradient;
      ctx.fillRect(0, scanY - 20, width, 40);
    };

    const drawUIOverlay = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      mouse: { x: number; y: number }
    ) => {
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(100, 200, 255, 0.6)";

      // Top left info
      ctx.fillText("MSK ULTRASOUND", 15, 25);
      ctx.fillText("FREQ: 12MHz", 15, 40);
      ctx.fillText("DEPTH: 4cm", 15, 55);

      // Top right
      ctx.textAlign = "right";
      ctx.fillText("THE REHAB STUDIO", width - 15, 25);
      ctx.fillText(`X: ${mouse.x > 0 ? mouse.x.toFixed(0) : "---"}`, width - 15, 40);
      ctx.fillText(`Y: ${mouse.y > 0 ? mouse.y.toFixed(0) : "---"}`, width - 15, 55);
      ctx.textAlign = "left";

      // Depth scale on right edge
      ctx.strokeStyle = "rgba(100, 200, 255, 0.3)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = 80 + i * ((height - 100) / 4);
        ctx.beginPath();
        ctx.moveTo(width - 30, y);
        ctx.lineTo(width - 15, y);
        ctx.stroke();
        ctx.fillText(`${i}cm`, width - 45, y + 3);
      }

      // Corner frame
      const cornerSize = 30;
      ctx.strokeStyle = "rgba(100, 200, 255, 0.4)";
      ctx.lineWidth = 2;

      // Top left corner
      ctx.beginPath();
      ctx.moveTo(10, 10 + cornerSize);
      ctx.lineTo(10, 10);
      ctx.lineTo(10 + cornerSize, 10);
      ctx.stroke();

      // Top right corner
      ctx.beginPath();
      ctx.moveTo(width - 10 - cornerSize, 10);
      ctx.lineTo(width - 10, 10);
      ctx.lineTo(width - 10, 10 + cornerSize);
      ctx.stroke();

      // Bottom left corner
      ctx.beginPath();
      ctx.moveTo(10, height - 10 - cornerSize);
      ctx.lineTo(10, height - 10);
      ctx.lineTo(10 + cornerSize, height - 10);
      ctx.stroke();

      // Bottom right corner
      ctx.beginPath();
      ctx.moveTo(width - 10 - cornerSize, height - 10);
      ctx.lineTo(width - 10, height - 10);
      ctx.lineTo(width - 10, height - 10 - cornerSize);
      ctx.stroke();
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initElements]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full -z-10"
      style={{ touchAction: "none" }}
      aria-hidden="true"
    />
  );
}
