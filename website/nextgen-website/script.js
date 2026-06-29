const nav = document.querySelector(".nav");
const navToggle = document.querySelector(".nav-toggle");

navToggle?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll(".nav a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

const filterButtons = document.querySelectorAll("[data-filter]");
const programCards = document.querySelectorAll(".program-card");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    programCards.forEach((card) => {
      card.hidden = filter !== "all" && card.dataset.category !== filter;
    });
  });
});

document.querySelector(".newsletter form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.querySelector("input");
  const button = event.currentTarget.querySelector("button");
  if (!input.value.trim()) {
    input.focus();
    return;
  }
  button.textContent = "Subscribed";
  event.currentTarget.reset();
});
