// =============================================================
// main.js — Bootstrap, tick loop, mutation handlers
// =============================================================

function queueStrays(resolvedList) {
  for (const r of resolvedList) {
    if (r && r.strayOffer) uiState.strayQueue.push(r.strayOffer);
  }
}

function boot() {
  gameState = loadState();
  refreshDailyChallenges();
  refreshWeeklyBoss();

  const summary = catchUpOffline();
  queueStrays(summary.resolved);

  renderAll();
  wireEvents(onMutation);

  // Modal priority: offline summary first (they have resolved rewards to see), then the
  // first-run welcome modal (brand-new save only), then any queued stray offer.
  if (summary.resolved.length) {
    openOfflineModal(summary);
  } else if (!gameState.tutorialSeen) {
    openWelcomeModal();
  } else {
    presentNextStray();
  }

  let frames = 0;
  function loop() {
    animateFrame();
    frames++;
    if (frames % 6 === 0) {
      const resolved = tick();
      if (resolved.length || resolved._research) {
        queueStrays(resolved);
        for (const r of resolved) showMissionToast(r);
        renderAll();
        presentQueuedFlashes();
        presentNextStray();
        presentNextGoldenMouse();
      }
    }
    // Once a minute, check for daily/weekly rollover.
    if (frames % 3600 === 0) {
      refreshDailyChallenges();
      refreshWeeklyBoss();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener("beforeunload", () => saveStateNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveStateNow();
  });
}

function onMutation() {
  renderAll();
  requestSave();
  // Drain flash toasts queued by synchronous actions (shop training, tonics, level-ups
  // that happen outside the tick loop, etc.).
  presentQueuedFlashes();
  // Stray + mouse presenters both no-op if a modal is already open.
  presentNextStray();
  presentNextGoldenMouse();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
