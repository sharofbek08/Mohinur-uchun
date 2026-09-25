    (() => {
      const STORAGE_KEY = "satrlarim-entries-v1";
      const starterEntries = [
        {
          id: "starter-poem",
          type: "poem",
          text: "Ko‘nglimda bir bahor uyg‘onsa agar,\nUning ilk hidi sening ismingdir.",
          author: "Shaxsiy daftar",
          tags: ["muhabbat", "bahor"],
          favorite: true,
          createdAt: "2026-09-20T08:00:00.000Z"
        },
        {
          id: "starter-quote",
          type: "quote",
          text: "Chiroyli so‘z — qalbga qo‘yilgan eng mayin qo‘ldir.",
          author: "Noma’lum",
          tags: ["so‘z", "ilhom"],
          favorite: false,
          createdAt: "2026-09-19T08:00:00.000Z"
        },
        {
          id: "starter-poem-2",
          type: "poem",
          text: "Yo‘llar uzoq bo‘lsa ham,\nYurak manzilini unutmaydi.",
          author: "Shaxsiy daftar",
          tags: ["sog‘inch", "yo‘l"],
          favorite: false,
          createdAt: "2026-09-18T08:00:00.000Z"
        }
      ];

      const entryList = document.getElementById("entry-list");
      const entryCount = document.getElementById("entry-count");
      const searchInput = document.getElementById("search-input");
      const dialog = document.getElementById("entry-dialog");
      const form = document.getElementById("entry-form");
      const errorMessage = document.getElementById("form-error");
      const toast = document.getElementById("toast");
      const dialogTitle = document.getElementById("dialog-title");
      const dialogDescription = document.getElementById("dialog-description");
      const editingId = document.getElementById("editing-id");
      const textField = document.getElementById("entry-text");
      const authorField = document.getElementById("entry-author");
      const tagsField = document.getElementById("entry-tags");
      
      let activeFilter = "all";
      let entries = loadEntries();
      let toastTimer;
      let entryCardObserver;

      // --- Google Sign-In integration (client-side) ---
      const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; // replace with your Client ID

      function decodeJwtResponse(token) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          return JSON.parse(jsonPayload);
        } catch {
          return null;
        }
      }

      function onGoogleCredential(response) {
        const payload = decodeJwtResponse(response.credential);
        if (!payload) return;
        const profile = {
          id: payload.sub,
          name: payload.name,
          email: payload.email,
          picture: payload.picture
        };
        localStorage.setItem('satrlarim-user', JSON.stringify(profile));
        showUser(profile);
      }

      function showUser(profile) {
        const signinBox = document.getElementById('g_id_signin');
        if (signinBox) signinBox.hidden = true;
        const ui = document.getElementById('user-info');
        const nameEl = document.getElementById('user-name');
        const pic = document.getElementById('user-pic');
        if (nameEl) nameEl.textContent = profile.name || profile.email;
        if (profile.picture && pic) { pic.src = profile.picture; pic.alt = profile.name || 'User picture'; pic.hidden = false; }
        if (ui) ui.hidden = false;
      }

      function signOut() {
        localStorage.removeItem('satrlarim-user');
        const ui = document.getElementById('user-info');
        const signinBox = document.getElementById('g_id_signin');
        if (ui) ui.hidden = true;
        if (signinBox) signinBox.hidden = false;
        try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch {}
      }

      function initGoogleSignIn() {
        try {
          const signinContainer = document.getElementById('g_id_signin');
          if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID') || GOOGLE_CLIENT_ID.includes('SIZNING_CLIENT_ID')) {
            // Don't attempt to initialize GSI with the placeholder client ID.
            if (signinContainer) signinContainer.hidden = true;
            return;
          }
          if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: onGoogleCredential,
              auto_select: false
            });
            google.accounts.id.renderButton(
              signinContainer,
              { theme: 'outline', size: 'large', text: 'signin_with' }
            );
          }
        } catch (e) {
          // Google Identity not available or initialization failed
        }
      }
      

      function loadEntries() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
          if (Array.isArray(saved)) return saved;
        } catch (error) {
          console.warn("Yozuvlarni o‘qib bo‘lmadi", error);
        }
        return starterEntries;
      }

      function saveEntries() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        } catch (error) {
          showToast("Yozuvni saqlash uchun brauzer xotirasi mavjud emas.");
        }
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      function formatDate(value) {
        // Numeric format: DD.MM.YYYY (e.g., 20.09.2026)
        try {
          const d = new Date(value);
          if (isNaN(d)) return "00.00.0000";
          const pad = (n) => String(n).padStart(2, "0");
          return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
        } catch {
          return "00.00.0000";
        }
      }

      function getFilteredEntries() {
        const query = searchInput.value.trim().toLocaleLowerCase("uz-UZ");
        return entries.filter((entry) => {
          const matchesFilter = activeFilter === "all"
            || (activeFilter === "favorite" && entry.favorite)
            || entry.type === activeFilter;
          const searchable = [entry.text, entry.author, ...(entry.tags || [])].join(" ").toLocaleLowerCase("uz-UZ");
          return matchesFilter && (!query || searchable.includes(query));
        });
      }

      function cardMarkup(entry) {
        const isPoem = entry.type === "poem";
        const typeName = isPoem ? "She’r" : "Qalbdagi so'zlar";
        const safeAuthor = entry.author ? escapeHtml(entry.author) : "Muallif ko‘rsatilmagan";
        const tags = (entry.tags || []).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join("");
        const favoriteText = entry.favorite ? "Sevimlidan olish" : "Sevimliga qo‘shish";
        return `
          <article class="entry-card reveal-card ${isPoem ? "poem" : "quote"}" data-id="${escapeHtml(entry.id)}">
            <div class="card-topline">
              <span class="type-label"><span class="type-dot" aria-hidden="true"></span>${typeName}</span>
              <time class="date" datetime="${escapeHtml(entry.createdAt)}">${formatDate(entry.createdAt)}</time>
            </div>
            <p class="entry-text">${escapeHtml(entry.text)}</p>
            <p class="entry-author">${safeAuthor}</p>
            <div class="card-footer">
              <div class="tag-list">${tags}</div>
              <div class="card-actions">
                <button class="small-button ${entry.favorite ? "is-favorite" : ""}" type="button" data-action="favorite" aria-label="${favoriteText}">${entry.favorite ? "♥ Sevimli" : "♡ Sevimli"}</button>
                <button class="small-button" type="button" data-action="copy">Nusxa olish</button>
                <button class="small-button" type="button" data-action="edit">Tahrirlash</button>
                <button class="small-button delete" type="button" data-action="delete">O‘chirish</button>
              </div>
            </div>
          </article>`;
      }

      function revealEntryCards() {
        if (entryCardObserver) {
          entryCardObserver.disconnect();
          entryCardObserver = undefined;
        }

        const cards = [...entryList.querySelectorAll(".reveal-card")];
        if (!cards.length) return;

        const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        if (prefersReducedMotion || !("IntersectionObserver" in window)) {
          cards.forEach((card) => card.classList.add("is-visible"));
          return;
        }

        entryCardObserver = new IntersectionObserver((observedCards, observer) => {
          observedCards.forEach((observedCard) => {
            if (!observedCard.isIntersecting) return;
            observedCard.target.classList.add("is-visible");
            observer.unobserve(observedCard.target);
          });
        }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });

        cards.forEach((card, index) => {
          card.style.setProperty("--card-delay", `${Math.min(index, 5) * 90}ms`);
          entryCardObserver.observe(card);
        });
      }

      function render() {
        const visibleEntries = getFilteredEntries();
        entryCount.textContent = `${visibleEntries.length} ta yozuv`;
        if (visibleEntries.length) {
          entryList.innerHTML = visibleEntries.map(cardMarkup).join("");
        } else {
          entryList.innerHTML = `
            <section class="empty-state">
              <h3>Bu yer hali jim.</h3>
              <p>Qidiruv so‘zingizga mos yozuv topilmadi yoki bu bo‘lim hali bo‘sh.</p>
              <button class="button button-secondary" type="button" data-action="open-add">Birinchi satrni saqlash</button>
            </section>`;
        }
        revealEntryCards();
        document.getElementById("total-count").textContent = entries.length;
        document.getElementById("poem-count").textContent = entries.filter((entry) => entry.type === "poem").length;
        document.getElementById("favorite-count").textContent = entries.filter((entry) => entry.favorite).length;
      }

      function showToast(message) {
        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.classList.add("show");
        toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
      }

      

      function openAddDialog() {
        form.reset();
        editingId.value = "";
        errorMessage.textContent = "";
        dialogTitle.textContent = "Yangi yozuv";
        dialogDescription.textContent = "Yuragingizga yaqin satrni saqlab qo‘ying.";
        dialog.showModal();
        window.setTimeout(() => textField.focus(), 50);
      }

      function openEditDialog(id) {
        const entry = entries.find((item) => item.id === id);
        if (!entry) return;
        form.reset();
        editingId.value = entry.id;
        document.querySelector(`input[name="entry-type"][value="${entry.type}"]`).checked = true;
        textField.value = entry.text;
        authorField.value = entry.author || "";
        tagsField.value = (entry.tags || []).join(", ");
        errorMessage.textContent = "";
        dialogTitle.textContent = "Yozuvni tahrirlash";
        dialogDescription.textContent = "Kerakli joylarini yangilang va qayta saqlang.";
        dialog.showModal();
        window.setTimeout(() => textField.focus(), 50);
      }

      function closeDialog() {
        if (dialog.open) dialog.close();
      }

      function normalizeTags(value) {
        return [...new Set(value.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 8);
      }

      async function copyEntry(entry) {
        const content = `${entry.text}${entry.author ? `\n— ${entry.author}` : ""}`;
        try {
          await navigator.clipboard.writeText(content);
          showToast("Yozuv nusxalandi.");
        } catch {
          const helper = document.createElement("textarea");
          helper.value = content;
          helper.style.position = "fixed";
          helper.style.opacity = "0";
          document.body.appendChild(helper);
          helper.select();
          document.execCommand("copy");
          helper.remove();
          showToast("Yozuv nusxalandi.");
        }
      }

      document.querySelectorAll("#open-add-dialog, #open-add-dialog-secondary").forEach((button) => {
        button.addEventListener("click", openAddDialog);
      });
      // wire sign-out button (if present)
      const signoutBtn = document.getElementById('signout-button');
      if (signoutBtn) signoutBtn.addEventListener('click', signOut);
      document.getElementById("close-dialog").addEventListener("click", closeDialog);
      document.getElementById("cancel-dialog").addEventListener("click", closeDialog);
      searchInput.addEventListener("input", render);

      document.querySelectorAll(".filter-chip").forEach((button) => {
        button.addEventListener("click", () => {
          activeFilter = button.dataset.filter;
          document.querySelectorAll(".filter-chip").forEach((chip) => {
            const active = chip === button;
            chip.classList.toggle("is-active", active);
            chip.setAttribute("aria-pressed", String(active));
          });
          render();
        });
      });

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = textField.value.trim();
        if (!text) {
          errorMessage.textContent = "Avval saqlamoqchi bo‘lgan satringizni yozing.";
          textField.focus();
          return;
        }
        const selectedType = document.querySelector('input[name="entry-type"]:checked').value;
        const entryData = {
          type: selectedType,
          text,
          author: authorField.value.trim(),
          tags: normalizeTags(tagsField.value)
        };
        const existingId = editingId.value;
        if (existingId) {
          const index = entries.findIndex((entry) => entry.id === existingId);
          if (index !== -1) entries[index] = { ...entries[index], ...entryData };
          showToast("Yozuv yangilandi.");
        } else {
          entries.unshift({ id: window.crypto?.randomUUID ? window.crypto.randomUUID() : `entry-${Date.now()}`, ...entryData, favorite: false, createdAt: new Date().toISOString() });
          showToast("Yangi yozuv saqlandi.");
        }
        saveEntries();
        render();
        closeDialog();
      });

      entryList.addEventListener("click", async (event) => {
        const target = event.target.closest("button");
        if (!target) return;
        if (target.dataset.action === "open-add") {
          openAddDialog();
          return;
        }
        const card = target.closest("[data-id]");
        if (!card) return;
        const id = card.dataset.id;
        const entry = entries.find((item) => item.id === id);
        if (!entry) return;
        if (target.dataset.action === "favorite") {
          entry.favorite = !entry.favorite;
          saveEntries();
          render();
          showToast(entry.favorite ? "Sevimlilarga qo‘shildi." : "Sevimlilardan olindi.");
        }
        if (target.dataset.action === "copy") await copyEntry(entry);
        if (target.dataset.action === "edit") openEditDialog(id);
        if (target.dataset.action === "delete") {
          if (window.confirm("Bu yozuvni o‘chirmoqchimisiz?")) {
            entries = entries.filter((item) => item.id !== id);
            saveEntries();
            render();
            showToast("Yozuv o‘chirildi.");
          }
        }
      });

      render();
      // Restore signed-in user if present
      try {
        const savedUser = JSON.parse(localStorage.getItem('satrlarim-user') || 'null');
        if (savedUser) showUser(savedUser);
      } catch {}
      // Initialize Google Sign-In (will only render if GSI script loaded)
      initGoogleSignIn();

      // --- Logo picker: load saved logo and wire dialog ---
      const brandLogo = document.getElementById('brand-logo');
      const logoDialog = document.getElementById('logo-dialog');
      const closeLogoBtn = document.getElementById('close-logo-dialog');

      function loadSavedLogo() {
        try {
          const saved = localStorage.getItem('satrlarim-logo');
          if (saved && brandLogo) brandLogo.src = saved;
        } catch {}
      }

      function openLogoDialog() {
        if (logoDialog) logoDialog.showModal();
      }

      function closeLogoDialog() {
        if (logoDialog && logoDialog.open) logoDialog.close();
      }

      document.querySelectorAll('.logo-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const src = btn.dataset.src;
          if (brandLogo) brandLogo.src = src;
          try { localStorage.setItem('satrlarim-logo', src); } catch {}
          closeLogoDialog();
        });
      });

      if (closeLogoBtn) closeLogoBtn.addEventListener('click', closeLogoDialog);
      loadSavedLogo();
    })();
