const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const main_container = document.querySelector(".main-container");

sign_up_btn.addEventListener("click", () => {
  main_container.classList.add("sign-up-mode");
});

sign_in_btn.addEventListener("click", () => {
  main_container.classList.remove("sign-up-mode");
});

// Select the required elements
const toggleButton = document.querySelector(".custom_menu-btn");
const navMenu = document.querySelector("#navbarSupportedContent");

// Toggle the menu visibility and button style
toggleButton.addEventListener("click", () => {
  navMenu.classList.toggle("lg_nav-toggle");
  toggleButton.classList.toggle("menu_btn-style");
});
