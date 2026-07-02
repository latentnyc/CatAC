// =============================================================
// main.js — Bootstrap, tick loop, mutation handlers
// =============================================================

function queueStrays(resolvedList) {
  for (const r of resolvedList) {
    if (r && r.strayOffer) uiState.strayQueue.push(r.strayOffer);
  }
}

function boot() {
  // v0.4.2: single-source version stamping. Any DOM element with `data-version` gets
  // "vX.Y.Z"; any `data-version-long` gets the longer "vX.Y.Z" form for settings blurbs.
  // Keeps index.html cache-buster ?v= params as the only places the literal appears.
  for (const el of document.querySelectorAll("[data-version]"))      el.textContent = "v" + BUILD_VERSION;
  for (const el of document.querySelectorAll("[data-version-long]")) el.textContent = "v" + BUILD_VERSION;

  gameState = loadState();
  refreshDailyChallenges();
  refreshWeeklyBoss();

  const summary = catchUpOffline();
  // Offline strays are pre-capped to the club's open slots by catchUpOffline (a long auto-repeat
  // gap could otherwise queue dozens of stray modals); queue that capped list directly.
  for (const stray of (summary.strays || [])) uiState.strayQueue.push(stray);

  renderAll();
  wireEvents(onMutation);
  // Restore the player's curated panel layout, then start persisting their toggles.
  applySavedPanelStates();
  wirePanelPersistence();

  // Modal priority: offline summary first (they have resolved rewards to see), then the
  // first-run welcome modal (brand-new save only), then any queued stray offer.
  if (summary.resolved.length) {
    openOfflineModal(summary);
  } else if (!gameState.tutorialSeen) {
    openWelcomeModal();
  } else if (gameState.lastSeenVersion !== BUILD_VERSION) {
    openWhatsNewModal();
  } else {
    presentNextStray();
  }

  // Make the version chip a "What's New" button so the changelog is always reachable.
  for (const el of document.querySelectorAll("[data-version]")) {
    el.style.cursor = "pointer";
    el.title = "What's new — click for the changelog";
    el.addEventListener("click", () => openWhatsNewModal());
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
      }
      // Golden Mouse can also arrive on its own wall-clock schedule (no mission needed), so try
      // to present one every tick; it no-ops when the queue is empty or a modal is already open.
      presentNextGoldenMouse();
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
    if (document.visibilityState === "hidden") { saveStateNow(); return; }
    // Refocus after a long background stretch: browsers throttle rAF to zero in hidden tabs,
    // so the whole gap would otherwise replay through live tick() — bypassing the offline cap
    // and every flood guard. Route real gaps through the same aggregated offline path as boot.
    const gapMs = Date.now() - (gameState?.lastTick || Date.now());
    if (gapMs > 5 * 60 * 1000) {
      const summary = catchUpOffline();
      for (const stray of (summary.strays || [])) uiState.strayQueue.push(stray);
      renderAll();
      if (summary.resolved.length) openOfflineModal(summary);
    }
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
