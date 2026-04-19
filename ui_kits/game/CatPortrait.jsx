// CatPortrait.jsx — procedurally drawn cat on canvas (copied from CatGame/js/render.js drawCat)
function CatPortrait({ palette, classIcon, onMission, size = 108 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const draw = () => {
      const w = size, h = size;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2 + 8;
      const t = performance.now() / 600;
      const tailWag = Math.sin(t) * 7;
      ctx.strokeStyle = palette.fur; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + 22, cy + 4);
      ctx.quadraticCurveTo(cx + 44 + tailWag, cy - 14, cx + 48 + tailWag, cy - 30); ctx.stroke();
      ctx.fillStyle = palette.fur;
      ctx.beginPath(); ctx.ellipse(cx, cy + 14, 28, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = palette.fur; ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 26); ctx.lineTo(cx - 10, cy + 34);
      ctx.moveTo(cx + 10, cy + 26); ctx.lineTo(cx + 10, cy + 34); ctx.stroke();
      ctx.fillStyle = palette.fur;
      ctx.beginPath();
      ctx.ellipse(cx - 10, cy + 35, 6, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 10, cy + 35, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy - 12, 20, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy - 22); ctx.lineTo(cx - 8, cy - 32); ctx.lineTo(cx - 6, cy - 18); ctx.closePath();
      ctx.moveTo(cx + 18, cy - 22); ctx.lineTo(cx + 8, cy - 32); ctx.lineTo(cx + 6, cy - 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = palette.accent;
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 22); ctx.lineTo(cx - 10, cy - 28); ctx.lineTo(cx - 9, cy - 20); ctx.closePath();
      ctx.moveTo(cx + 15, cy - 22); ctx.lineTo(cx + 10, cy - 28); ctx.lineTo(cx + 9, cy - 20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(cx - 7, cy - 12, 4, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 7, cy - 12, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = palette.eyes;
      ctx.beginPath(); ctx.ellipse(cx - 7, cy - 12, 2.6, 4.2, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 7, cy - 12, 2.6, 4.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(cx - 7, cy - 12, 1, 3.6, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 7, cy - 12, 1, 3.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#D97A8F';
      ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx - 3, cy - 1); ctx.lineTo(cx + 3, cy - 1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 2); ctx.lineTo(cx - 22, cy - 4);
      ctx.moveTo(cx - 10, cy + 1); ctx.lineTo(cx - 22, cy + 2);
      ctx.moveTo(cx + 10, cy - 2); ctx.lineTo(cx + 22, cy - 4);
      ctx.moveTo(cx + 10, cy + 1); ctx.lineTo(cx + 22, cy + 2); ctx.stroke();
      ctx.fillStyle = '#2a2a33'; ctx.beginPath(); ctx.arc(w - 14, 14, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd866'; ctx.font = 'bold 14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(classIcon, w - 14, 14);
      if (onMission) {
        ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, h - 16, w, 16);
        ctx.fillStyle = '#ffd866'; ctx.font = 'bold 10px sans-serif';
        ctx.fillText('ON MISSION', w / 2, h - 8);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [palette, classIcon, onMission, size]);
  return <canvas ref={ref} width={size} height={size} className="cat-portrait" />;
}
window.CatPortrait = CatPortrait;
