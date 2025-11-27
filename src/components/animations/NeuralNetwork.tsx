"use client";

import { useEffect, useRef, useCallback } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  activated: number;
}

interface Connection {
  from: number;
  to: number;
  impulseProgress: number;
  active: boolean;
}

export function NeuralNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const nodesRef = useRef<Node[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const animationRef = useRef<number>(0);

  const initNodes = useCallback((width: number, height: number) => {
    const nodes: Node[] = [];
    const nodeCount = Math.floor((width * height) / 25000); // Densidad adaptativa

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius: 2 + Math.random() * 1.5,
        pulsePhase: 0,
        activated: 0,
      });
    }

    // Crear conexiones entre nodos cercanos
    const connections: Connection[] = [];
    const maxDistance = 150;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxDistance) {
          connections.push({
            from: i,
            to: j,
            impulseProgress: -1,
            active: false,
          });
        }
      }
    }

    nodesRef.current = nodes;
    connectionsRef.current = connections;
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
      initNodes(rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // Calcular posición relativa al canvas considerando scroll
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    // Escuchar eventos en el documento completo para capturar el mouse incluso sobre otros elementos
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    let lastTime = 0;
    const animate = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 16, 2);
      lastTime = time;

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const nodes = nodesRef.current;
      const connections = connectionsRef.current;
      const mouse = mouseRef.current;
      const activationRadius = 120;

      // Actualizar nodos
      nodes.forEach((node, i) => {
        // Movimiento suave
        node.x += node.vx * deltaTime;
        node.y += node.vy * deltaTime;

        // Rebote en bordes
        if (node.x < 0 || node.x > rect.width) node.vx *= -1;
        if (node.y < 0 || node.y > rect.height) node.vy *= -1;

        // Mantener en límites
        node.x = Math.max(0, Math.min(rect.width, node.x));
        node.y = Math.max(0, Math.min(rect.height, node.y));

        // Activación por proximidad al cursor
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);

        if (distToMouse < activationRadius) {
          node.activated = Math.min(1, node.activated + 0.1 * deltaTime);

          // Activar conexiones desde este nodo
          connections.forEach((conn) => {
            if ((conn.from === i || conn.to === i) && !conn.active && Math.random() < 0.02) {
              conn.active = true;
              conn.impulseProgress = conn.from === i ? 0 : 1;
            }
          });
        } else {
          node.activated = Math.max(0, node.activated - 0.02 * deltaTime);
        }
      });

      // Dibujar conexiones
      connections.forEach((conn) => {
        const nodeA = nodes[conn.from];
        const nodeB = nodes[conn.to];
        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 150) return;

        const baseAlpha = Math.max(0, 0.15 - distance / 1000);
        const activationBoost = (nodeA.activated + nodeB.activated) / 2;

        // Línea base
        ctx.beginPath();
        ctx.moveTo(nodeA.x, nodeA.y);
        ctx.lineTo(nodeB.x, nodeB.y);
        ctx.strokeStyle = `rgba(59, 130, 246, ${baseAlpha + activationBoost * 0.3})`;
        ctx.lineWidth = 0.5 + activationBoost;
        ctx.stroke();

        // Impulso eléctrico viajando
        if (conn.active) {
          const impulseX = nodeA.x + dx * conn.impulseProgress;
          const impulseY = nodeA.y + dy * conn.impulseProgress;

          // Glow del impulso (suave)
          const gradient = ctx.createRadialGradient(
            impulseX,
            impulseY,
            0,
            impulseX,
            impulseY,
            12
          );
          gradient.addColorStop(0, "rgba(59, 130, 246, 0.6)");
          gradient.addColorStop(0.5, "rgba(59, 130, 246, 0.2)");
          gradient.addColorStop(1, "rgba(59, 130, 246, 0)");

          ctx.beginPath();
          ctx.arc(impulseX, impulseY, 12, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          // Punto central brillante
          ctx.beginPath();
          ctx.arc(impulseX, impulseY, 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.fill();

          // Avanzar impulso (siempre hacia adelante, velocidad constante)
          conn.impulseProgress += 0.015;

          if (conn.impulseProgress >= 1) {
            conn.active = false;
            conn.impulseProgress = -1;
            // Activar el nodo destino
            nodeB.activated = 1;
          }
        }
      });

      // Dibujar nodos
      nodes.forEach((node) => {
        const size = node.radius * (1 + node.activated * 0.3);

        // Glow cuando activado
        if (node.activated > 0.1) {
          const glowGradient = ctx.createRadialGradient(
            node.x,
            node.y,
            0,
            node.x,
            node.y,
            size * 4
          );
          glowGradient.addColorStop(0, `rgba(59, 130, 246, ${0.4 * node.activated})`);
          glowGradient.addColorStop(1, "rgba(59, 130, 246, 0)");

          ctx.beginPath();
          ctx.arc(node.x, node.y, size * 4, 0, Math.PI * 2);
          ctx.fillStyle = glowGradient;
          ctx.fill();
        }

        // Nodo principal
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);

        const nodeColor = node.activated > 0.1
          ? `rgba(${100 + 155 * node.activated}, ${150 + 105 * node.activated}, 246, ${0.5 + node.activated * 0.5})`
          : `rgba(59, 130, 246, 0.4)`;

        ctx.fillStyle = nodeColor;
        ctx.fill();

        // Centro brillante cuando muy activado
        if (node.activated > 0.5) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, size * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${node.activated * 0.8})`;
          ctx.fill();
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initNodes]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ touchAction: "none" }}
      aria-hidden="true"
    />
  );
}
