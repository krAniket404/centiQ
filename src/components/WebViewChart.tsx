import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const C = {
  bg: "#080808", accent: "#38BDF8", textSecondary: "#B8B8B8"
};

interface WebViewChartProps {
  data: { day: string; amount: number }[];
  activeDay: number | null;
  setActiveDay: (i: number | null) => void;
}

export default function WebViewChart({ data, activeDay, setActiveDay }: WebViewChartProps) {
  const chartWidth = Dimensions.get('window').width - 92; // Match card padding
  const chartHeight = 160;

  // Generate the HTML/JS to draw the chart on an HTML5 Canvas
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; background-color: transparent; }
        canvas { background-color: transparent; }
      </style>
    </head>
    <body>
      <canvas id="chart" width="${chartWidth}" height="${chartHeight}"></canvas>
      <script>
        const amounts = ${JSON.stringify(data.map(d => d.amount))};
        const days = ${JSON.stringify(data.map(d => d.day))};
        const activeDay = ${activeDay !== null ? activeDay : 'null'};
        const canvas = document.getElementById('chart');
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const maxVal = Math.max(...amounts, 1);
        const padding = 20;

        // Map data to X and Y coordinates
        const points = amounts.map((val, i) => {
          const x = (i / (amounts.length - 1)) * W;
          const y = H - ((val / maxVal) * (H - padding * 2)) - padding;
          return { x, y };
        });

        // 1. Draw Area Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(points[0].x, H);
        points.forEach((p, i) => {
          if (i === 0) ctx.lineTo(p.x, p.y);
          else {
            const prev = points[i - 1];
            const xc = (prev.x + p.x) / 2;
            const yc = (prev.y + p.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, xc, yc);
          }
        });
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.lineTo(points[points.length - 1].x, H);
        ctx.closePath();
        ctx.fill();

        // 2. Draw Smooth Line
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else {
            const prev = points[i - 1];
            const xc = (prev.x + p.x) / 2;
            const yc = (prev.y + p.y) / 2;
            ctx.quadraticCurveTo(prev.x, prev.y, xc, yc);
          }
        });
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();

        // 3. Draw Dots
        points.forEach((p, i) => {
          ctx.beginPath();
          if (activeDay === i) {
            // Active Dot (Glowing)
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#38BDF8';
            ctx.shadowColor = '#38BDF8';
            ctx.shadowBlur = 10;
            ctx.fill();
          } else {
            // Inactive Dot
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#080808';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#38BDF8';
            ctx.stroke();
          }
          ctx.shadowBlur = 0; // Reset shadow
        });

        // 4. Draw Tooltip
        if (activeDay !== null) {
          const p = points[activeDay];
          const val = amounts[activeDay];
          ctx.fillStyle = '#111111';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
          ctx.lineWidth = 1;
          ctx.fillRect(p.x - 20, p.y - 35, 40, 20);
          ctx.strokeRect(p.x - 20, p.y - 35, 40, 20);
          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('₹' + val.toFixed(0), p.x, p.y - 21);
        }

        // 5. Handle Clicks
        canvas.addEventListener('click', (e) => {
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          let closestIndex = 0;
          let minDist = Infinity;
          points.forEach((p, i) => {
            const dist = Math.abs(p.x - x);
            if (dist < minDist) {
              minDist = dist;
              closestIndex = i;
            }
          });
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'click', index: closestIndex }));
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={{ width: chartWidth, height: chartHeight }}>
      <WebView
        source={{ html }}
        style={{ backgroundColor: 'transparent', width: chartWidth, height: chartHeight }}
        onMessage={(event) => {
          const msg = JSON.parse(event.nativeEvent.data);
          if (msg.type === 'click') {
            setActiveDay(activeDay === msg.index ? null : msg.index);
          }
        }}
        scrollEnabled={false}
        javaScriptEnabled={true}
      />
    </View>
  );
}