(function () {
  "use strict";

  // ---------- State ----------
  const defaultHidden = SLIDES.filter((s) => s.defaultOn === false).map((s) => s.id);
  const params = new URLSearchParams(location.search);

  let hiddenSet = new Set(defaultHidden);
  if (params.has("hidden")) {
    const raw = params.get("hidden").trim();
    hiddenSet = raw === "" ? new Set() : new Set(raw.split(",").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n)));
  }

  // Play order can be rearranged within a section from the Customize panel
  // (?order=1,2,4,3,5,...). Missing/unknown ids fall back to the deck's own
  // order so an old share link still works if the deck is ever updated.
  function buildPlayOrder() {
    const raw = params.get("order");
    if (!raw) return SLIDES.slice();
    const ids = raw.split(",").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
    const byId = new Map(SLIDES.map((s) => [s.id, s]));
    const seen = new Set();
    const result = [];
    ids.forEach((id) => {
      const s = byId.get(id);
      if (s && !seen.has(id)) {
        result.push(s);
        seen.add(id);
      }
    });
    SLIDES.forEach((s) => {
      if (!seen.has(s.id)) {
        result.push(s);
        seen.add(s.id);
      }
    });
    return result;
  }
  let playOrder = buildPlayOrder();

  // OneDrive/SharePoint share links open a viewer page, not the raw image —
  // they need a `download=1` param to serve actual image bytes. Rather than
  // ask a presenter to hand-edit the URL, detect those hosts and add it
  // ourselves so pasting the plain "Copy link" URL just works.
  function normalizeImageUrl(rawUrl) {
    try {
      const u = new URL(rawUrl, location.href);
      const isOneDrive =
        /(^|\.)sharepoint\.com$/i.test(u.hostname) ||
        /(^|\.)1drv\.ms$/i.test(u.hostname) ||
        /(^|\.)onedrive\.live\.com$/i.test(u.hostname);
      if (isOneDrive && !u.searchParams.has("download")) {
        u.searchParams.set("download", "1");
      }
      return u.toString();
    } catch {
      return rawUrl; // not a parseable absolute URL — leave it alone
    }
  }

  let logoUrl = params.get("logo") ? normalizeImageUrl(params.get("logo")) : null;
  let currentIndex = 0;

  // Slides that can have their baked-in placeholder image swapped for a
  // presenter-supplied one (currently just the blank data-table slides).
  // The swap lives entirely in the share link (?img14=...&img22=...) — the
  // master deck's own image files are never touched.
  const CUSTOM_IMAGE_IDS = SLIDES.filter((s) => s.customImage).map((s) => s.id);
  const customImages = {}; // id -> url
  CUSTOM_IMAGE_IDS.forEach((id) => {
    const v = params.get("img" + id);
    if (v) customImages[id] = normalizeImageUrl(v);
  });

  function defaultSlideSrc(id) {
    return "slides/slide-" + String(id).padStart(2, "0") + ".webp";
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  // ---------- Build slides ----------
  const track = document.getElementById("slideTrack");
  let slideEls = {}; // id -> element

  function buildSlideTrack() {
    track.innerHTML = "";
    slideEls = {};
    playOrder.forEach((s) => {
      const el = document.createElement("div");
      el.className = "slide";
      el.dataset.id = s.id;

      if (s.live) {
        el.innerHTML = buildCoverHTML();
      } else {
        const img = document.createElement("img");
        img.className = "slide-img";
        img.src = customImages[s.id] || defaultSlideSrc(s.id);
        img.alt = s.label;
        img.draggable = false;
        el.appendChild(img);
      }
      track.appendChild(el);
      slideEls[s.id] = el;
    });
  }
  buildSlideTrack();

  function buildCoverHTML() {
    return (
      '<div class="cover-slide" id="coverSlide">' +
      '<div class="divider"></div>' +
      '<img class="moc-logo" src="assets/moc-box-logo.png" alt="MOC Products Group" />' +
      '<div class="partner-logo-slot" id="partnerLogoSlot">' +
      '<div class="slot-hint">Your logo here</div>' +
      "</div>" +
      "</div>"
    );
  }

  function applyLogoToCover() {
    const slot = document.getElementById("partnerLogoSlot");
    const coverSlide = document.getElementById("coverSlide");
    if (!slot || !coverSlide) return;
    const existingImg = slot.querySelector("img");
    if (logoUrl) {
      coverSlide.classList.remove("show-hint");
      if (existingImg) {
        existingImg.src = logoUrl;
      } else {
        const img = document.createElement("img");
        img.src = logoUrl;
        img.alt = "Partner logo";
        slot.insertBefore(img, slot.firstChild);
      }
    } else {
      if (existingImg) existingImg.remove();
      coverSlide.classList.remove("show-hint");
    }
  }

  // ---------- Visible-slide order ----------
  function visibleSlideIds() {
    return playOrder.filter((s) => !hiddenSet.has(s.id)).map((s) => s.id);
  }

  function render() {
    const visible = visibleSlideIds();
    if (visible.length === 0) {
      // never allow a fully empty deck — fall back to the cover
      hiddenSet.delete(1);
      return render();
    }
    if (currentIndex >= visible.length) currentIndex = visible.length - 1;
    if (currentIndex < 0) currentIndex = 0;

    Object.keys(slideEls).forEach((id) => slideEls[id].classList.remove("is-active"));
    const activeId = visible[currentIndex];
    slideEls[activeId].classList.add("is-active");

    document.getElementById("counter").textContent =
      (currentIndex + 1) + " / " + visible.length;
    document.getElementById("progress").style.width =
      ((currentIndex + 1) / visible.length) * 100 + "%";

    document.getElementById("prevBtn").disabled = currentIndex === 0;
    document.getElementById("nextBtn").disabled = currentIndex === visible.length - 1;

    applyLogoToCover();
    syncUrl();
  }

  function goTo(delta) {
    currentIndex += delta;
    render();
  }

  // ---------- Nav controls ----------
  document.getElementById("prevBtn").addEventListener("click", () => goTo(-1));
  document.getElementById("nextBtn").addEventListener("click", () => goTo(1));

  document.addEventListener("keydown", (e) => {
    if (drawer.classList.contains("is-open")) return;
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goTo(1); }
    if (e.key === "ArrowLeft") goTo(-1);
    if (e.key === "Home") { e.preventDefault(); currentIndex = 0; render(); }
    if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
  });

  // click left/right half of the stage to navigate
  document.getElementById("stage").addEventListener("click", (e) => {
    if (e.target.closest(".nav-arrow, .chrome-btn")) return;
    const rect = track.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right) return;
    const mid = rect.left + rect.width / 2;
    goTo(e.clientX < mid ? -1 : 1);
  });

  // touch swipe
  let touchStartX = null;
  track.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) goTo(dx < 0 ? 1 : -1);
    touchStartX = null;
  });

  // jump back to the first slide without a page reload
  document.getElementById("restartBtn").addEventListener("click", () => {
    currentIndex = 0;
    render();
  });

  // fullscreen
  document.getElementById("fullscreenBtn").addEventListener("click", () => {
    const stage = document.getElementById("stage");
    if (!document.fullscreenElement) {
      (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
    } else {
      document.exitFullscreen();
    }
  });

  // ---------- Drawer ----------
  const drawer = document.getElementById("drawer");
  const overlay = document.getElementById("overlay");

  function openDrawer() {
    drawer.classList.add("is-open");
    overlay.classList.add("is-visible");
    drawer.setAttribute("aria-hidden", "false");
  }
  function closeDrawer() {
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-visible");
    drawer.setAttribute("aria-hidden", "true");
  }
  document.getElementById("customizeBtn").addEventListener("click", openDrawer);
  document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  // ---------- Slide checklist ----------
  const slideList = document.getElementById("slideList");

  const REORDER_UP_SVG = '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const REORDER_DOWN_SVG = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function buildSlideList() {
    slideList.innerHTML = "";
    let lastSection = null;
    let sectionStartIdx = 0;

    playOrder.forEach((s, idx) => {
      if (s.section !== lastSection) {
        const h = document.createElement("div");
        h.className = "section-heading";
        h.textContent = s.section;
        slideList.appendChild(h);
        lastSection = s.section;
        sectionStartIdx = idx;
      }
      // The cover (id 1) never moves and never gets swapped with, so the
      // slide right after it also counts as "first" even though it isn't
      // literally first in the section array.
      const isFirstInSection = idx === sectionStartIdx || playOrder[idx - 1].id === 1;
      const isLastInSection = idx === playOrder.length - 1 || playOrder[idx + 1].section !== s.section;
      const canReorder = s.id !== 1; // the cover always opens the deck

      const row = document.createElement("label");
      row.className = "slide-row";
      const hasImage = !!customImages[s.id];
      row.innerHTML =
        '<input type="checkbox" data-id="' + s.id + '" ' + (hiddenSet.has(s.id) ? "" : "checked") + (s.id === 1 ? " disabled" : "") + " />" +
        '<div class="slide-row-main">' +
        '<div class="slide-row-label"><span class="slide-row-num">' + String(s.id).padStart(2, "0") + "</span><span>" + s.label + "</span></div>" +
        (s.flag ? '<div class="slide-row-flag">' + s.flag + "</div>" : "") +
        (s.customImage
          ? '<div class="slide-row-custom">' +
              '<input type="url" class="custom-img-input" data-id="' + s.id + '" placeholder="Paste image link…" value="' + (hasImage ? escapeAttr(customImages[s.id]) : "") + '" />' +
              '<button type="button" class="custom-img-apply" data-id="' + s.id + '">Add</button>' +
              '<button type="button" class="custom-img-remove' + (hasImage ? "" : " is-hidden") + '" data-id="' + s.id + '">Remove</button>' +
            "</div>" +
            '<div class="custom-img-status" data-id="' + s.id + '">' + (hasImage ? "Added. Now showing on the deck." : "") + "</div>"
          : "") +
        "</div>" +
        (canReorder
          ? '<div class="slide-row-reorder">' +
              '<button type="button" class="reorder-btn reorder-up" data-id="' + s.id + '"' + (isFirstInSection ? " disabled" : "") + ' aria-label="Move up within this section" title="Move up within this section">' + REORDER_UP_SVG + "</button>" +
              '<button type="button" class="reorder-btn reorder-down" data-id="' + s.id + '"' + (isLastInSection ? " disabled" : "") + ' aria-label="Move down within this section" title="Move down within this section">' + REORDER_DOWN_SVG + "</button>" +
            "</div>"
          : "");
      slideList.appendChild(row);
    });
  }
  buildSlideList();

  slideList.addEventListener("change", (e) => {
    const cb = e.target.closest("input[type=checkbox]");
    if (!cb) return;
    const id = parseInt(cb.dataset.id, 10);
    if (cb.checked) hiddenSet.delete(id);
    else hiddenSet.add(id);
    currentIndex = 0;
    render();
    updateShareLink();
  });

  // ---------- Reorder within a section ----------
  function moveSlide(id, direction) {
    const idx = playOrder.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= playOrder.length) return;
    if (playOrder[swapIdx].section !== playOrder[idx].section) return;
    if (playOrder[idx].id === 1 || playOrder[swapIdx].id === 1) return; // cover never moves

    const activeId = visibleSlideIds()[currentIndex]; // keep showing the same slide

    const tmp = playOrder[idx];
    playOrder[idx] = playOrder[swapIdx];
    playOrder[swapIdx] = tmp;

    buildSlideTrack();
    buildSlideList();

    const newIdx = visibleSlideIds().indexOf(activeId);
    currentIndex = newIdx === -1 ? 0 : newIdx;

    render();
    updateShareLink();
  }

  // ---------- Custom slide images (data-table slides) ----------
  function setSlideImage(id, url) {
    if (url) {
      customImages[id] = url;
      hiddenSet.delete(id); // added real data — show it by default
    } else {
      delete customImages[id];
    }

    const img = slideEls[id] && slideEls[id].querySelector("img.slide-img");
    if (img) img.src = url || defaultSlideSrc(id);

    const cb = slideList.querySelector('input[type="checkbox"][data-id="' + id + '"]');
    if (cb) cb.checked = !hiddenSet.has(id);

    const statusEl = slideList.querySelector('.custom-img-status[data-id="' + id + '"]');
    if (statusEl) statusEl.textContent = url ? "Added. Now showing on the deck." : "";

    const removeBtn = slideList.querySelector('.custom-img-remove[data-id="' + id + '"]');
    if (removeBtn) removeBtn.classList.toggle("is-hidden", !url);

    currentIndex = 0;
    render();
    updateShareLink();
  }

  slideList.addEventListener("click", (e) => {
    const upBtn = e.target.closest(".reorder-up");
    if (upBtn) {
      if (!upBtn.disabled) moveSlide(parseInt(upBtn.dataset.id, 10), -1);
      return;
    }
    const downBtn = e.target.closest(".reorder-down");
    if (downBtn) {
      if (!downBtn.disabled) moveSlide(parseInt(downBtn.dataset.id, 10), 1);
      return;
    }
    const applyBtn = e.target.closest(".custom-img-apply");
    if (applyBtn) {
      const id = parseInt(applyBtn.dataset.id, 10);
      const input = slideList.querySelector('.custom-img-input[data-id="' + id + '"]');
      const val = input.value.trim();
      if (!val) return;
      setSlideImage(id, normalizeImageUrl(val));
      return;
    }
    const removeBtn = e.target.closest(".custom-img-remove");
    if (removeBtn) {
      const id = parseInt(removeBtn.dataset.id, 10);
      const input = slideList.querySelector('.custom-img-input[data-id="' + id + '"]');
      if (input) input.value = "";
      setSlideImage(id, null);
    }
  });

  slideList.addEventListener("keydown", (e) => {
    const input = e.target.closest(".custom-img-input");
    if (input && e.key === "Enter") {
      e.preventDefault();
      const id = input.dataset.id;
      const btn = slideList.querySelector('.custom-img-apply[data-id="' + id + '"]');
      if (btn) btn.click();
    }
  });

  // ---------- Logo: paste URL ----------
  document.getElementById("applyLogoUrl").addEventListener("click", () => {
    const val = document.getElementById("logoUrlInput").value.trim();
    if (!val) return;
    setLogo(normalizeImageUrl(val));
  });
  document.getElementById("logoUrlInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("applyLogoUrl").click();
  });

  function setLogo(url) {
    logoUrl = url;
    document.getElementById("logoPreview").src = url;
    document.getElementById("logoPreviewWrap").classList.remove("is-hidden");
    applyLogoToCover();
    updateShareLink();
  }

  document.getElementById("removeLogo").addEventListener("click", () => {
    logoUrl = null;
    document.getElementById("logoPreviewWrap").classList.add("is-hidden");
    document.getElementById("logoUrlInput").value = "";
    applyLogoToCover();
    updateShareLink();
  });

  // ---------- Share link ----------
  function buildShareUrl() {
    const url = new URL(location.href);
    url.search = "";
    const hiddenArr = Array.from(hiddenSet).sort((a, b) => a - b);
    url.searchParams.set("hidden", hiddenArr.join(","));
    if (logoUrl) url.searchParams.set("logo", logoUrl);
    CUSTOM_IMAGE_IDS.forEach((id) => {
      if (customImages[id]) url.searchParams.set("img" + id, customImages[id]);
    });
    const defaultOrder = SLIDES.map((s) => s.id).join(",");
    const currentOrder = playOrder.map((s) => s.id).join(",");
    if (currentOrder !== defaultOrder) {
      url.searchParams.set("order", currentOrder);
    }
    return url.toString();
  }

  function updateShareLink() {
    document.getElementById("shareLink").value = buildShareUrl();
  }

  function syncUrl() {
    history.replaceState(null, "", buildShareUrl());
  }

  document.getElementById("copyLink").addEventListener("click", () => {
    const input = document.getElementById("shareLink");
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
      document.getElementById("copyConfirm").textContent = "Copied.";
      setTimeout(() => (document.getElementById("copyConfirm").textContent = ""), 2000);
    }).catch(() => {
      document.execCommand("copy");
    });
  });

  // ---------- Init ----------
  if (logoUrl) {
    document.getElementById("logoUrlInput").value = logoUrl;
    document.getElementById("logoPreview").src = logoUrl;
    document.getElementById("logoPreviewWrap").classList.remove("is-hidden");
  }
  updateShareLink();
  render();
})();
