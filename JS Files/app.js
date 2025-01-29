const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const container = document.querySelector(".container");

sign_up_btn.addEventListener('click', () => {
    container.classList.add("sign-up-mode");
});

sign_in_btn.addEventListener('click', () => {
    container.classList.remove("sign-up-mode");
});

/*Password visibility*/
const passwordInputs = document.querySelectorAll("#signin-password, #signup-password, #confirm-password");
const togglePasswords = document.querySelectorAll("#toggle-password-signin, #toggle-password-signup, #toggle-password-confirm");
const toggleIcons = document.querySelectorAll("#toggle-password-signin i, #toggle-password-signup i, #toggle-password-confirm i");

// Show or hide the eye icon based on the input's value
passwordInputs.forEach((passwordInput, index) => {
  passwordInput.addEventListener("input", () => {
    if (passwordInput.value.length > 0) {
      togglePasswords[index].style.display = "inline";
    } else {
      togglePasswords[index].style.display = "none";
    }
  });
});

// Toggle the password visibility and the icon
togglePasswords.forEach((togglePassword, index) => {
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInputs[index].type === "password";
    passwordInputs[index].type = isPassword ? "text" : "password";
    toggleIcons[index].classList.toggle("fa-eye");
    toggleIcons[index].classList.toggle("fa-eye-slash");
  });
});
