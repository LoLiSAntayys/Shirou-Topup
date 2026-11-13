"use strict";

const packageList = document.querySelector("#package-list");
const orderForm = document.querySelector("#order-form");
const submitButton = document.querySelector("#submit-order");
const formMessage = document.querySelector("#form-message");
const summaryPackage = document.querySelector("#summary-package");
const summaryPrice = document.querySelector("#summary-price");
const trackForm = document.querySelector("#track-form");
const trackMessage = document.querySelector("#track-message");
const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

let packages = [];
let selectedPackage = null;

document.querySelector("#year").textContent = new Date().getFullYear();

function showMessage(element, text, isError) {
  element.textContent = text;
  element.classList.toggle("error", Boolean(isError));
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function renderPackages(items) {
  packages = items;
  if (!items.length) {
    packageList.innerHTML = '<div class="empty-card">Paket belum tersedia. Coba lagi nanti.</div>';
    return;
  }

  packageList.innerHTML = items.map(function (item, index) {
    const bonus = item.bonus_diamonds ? "Bonus +" + item.bonus_diamonds + " diamonds" : "Diamond MLBB";
    const badge = index === 1 ? '<span class="popular">POPULER</span>' : "";
    return '<button type="button" class="package-card" data-package-id="' + Number(item.id) + '" aria-pressed="false">' +
      badge +
      '<span class="package-name">' + escapeText(item.name) + "</span>" +
      '<span class="package-bonus">' + escapeText(bonus) + "</span>" +
      '<span class="package-price">' + money.format(Number(item.price_idr)) + "</span>" +
      "</button>";
  }).join("");

  packageList.querySelectorAll(".package-card").forEach(function (button) {
    button.addEventListener("click", function () {
      selectedPackage = packages.find(function (item) {
        return Number(item.id) === Number(button.dataset.packageId);
      });
      packageList.querySelectorAll(".package-card").forEach(function (card) {
        const isSelected = card === button;
        card.classList.toggle("selected", isSelected);
        card.setAttribute("aria-pressed", String(isSelected));
      });
      summaryPackage.textContent = selectedPackage.name;
      summaryPrice.textContent = money.format(Number(selectedPackage.price_idr));
      submitButton.disabled = false;
      showMessage(formMessage, "", false);
    });
  });
}

async function loadPackages() {
  try {
    const response = await fetch("/api/packages");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Katalog gagal dimuat.");
    renderPackages(data.packages || []);
  } catch (error) {
    packageList.innerHTML = '<div class="empty-card">Katalog belum bisa dimuat. Muat ulang halaman beberapa saat lagi.</div>';
    showMessage(formMessage, error.message, true);
  }
}

orderForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (!selectedPackage) {
    showMessage(formMessage, "Pilih paket diamond terlebih dahulu.", true);
    return;
  }

  const formData = new FormData(orderForm);
  const payload = {
    packageId: selectedPackage.id,
    playerId: String(formData.get("playerId") || "").trim(),
    serverId: String(formData.get("serverId") || "").trim(),
    email: String(formData.get("email") || "").trim()
  };

  submitButton.disabled = true;
  submitButton.textContent = "Membuat order...";
  showMessage(formMessage, "", false);

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Order belum bisa dibuat.");

    const order = data.order;
    showMessage(
      formMessage,
      "Order " + order.order_code + " dibuat dengan status Menunggu pembayaran. Pembayaran online belum tersedia.",
      false
    );
    document.querySelector("#order-code").value = order.order_code;
    document.querySelector("#track-form").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    showMessage(formMessage, error.message, true);
  } finally {
    submitButton.innerHTML = 'Buat order <span aria-hidden="true">↗</span>';
    submitButton.disabled = !selectedPackage;
  }
});

trackForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const code = String(new FormData(trackForm).get("orderCode") || "").trim().toUpperCase();
  showMessage(trackMessage, "Mencari order...", false);

  try {
    const response = await fetch("/api/orders/" + encodeURIComponent(code));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Order tidak ditemukan.");

    const order = data.order;
    const result = document.createElement("div");
    result.className = "track-result";
    result.innerHTML = "<strong>" + escapeText(order.order_code) + "</strong> · " +
      escapeText(order.package_name) + " · " + money.format(Number(order.price_idr)) +
      "<br>Status: <strong>" + escapeText(order.status.replaceAll("_", " ")) + "</strong>";
    const oldResult = trackForm.querySelector(".track-result");
    if (oldResult) oldResult.remove();
    trackForm.append(result);
    showMessage(trackMessage, "", false);
  } catch (error) {
    const oldResult = trackForm.querySelector(".track-result");
    if (oldResult) oldResult.remove();
    showMessage(trackMessage, error.message, true);
  }
});

loadPackages();
