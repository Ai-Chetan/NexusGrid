/*Sign In to Sign Up Toggle*/
const sign_in_btn = document.querySelector("#sign-in-btn");
const sign_up_btn = document.querySelector("#sign-up-btn");
const container = document.querySelector(".main-container");

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

/*Show or hide the eye icon based on the input's value*/
passwordInputs.forEach((passwordInput, index) => {
  passwordInput.addEventListener("input", () => {
    if (passwordInput.value.length > 0) {
      togglePasswords[index].style.display = "inline";
    } else {
      togglePasswords[index].style.display = "none";
    }
  });
});

/*Toggle the password visibility and the icon*/
togglePasswords.forEach((togglePassword, index) => {
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInputs[index].type === "password";
    passwordInputs[index].type = isPassword ? "text" : "password";
    toggleIcons[index].classList.toggle("fa-eye-slash");
    toggleIcons[index].classList.toggle("fa-eye");
  });
});

/*Sign Up Form Flow*/
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("get-otp-btn").addEventListener("click", function (event) {
      event.preventDefault(); // Prevent form submission

      let emailInput = document.getElementById("signup-email")?.value.trim();
      let emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // Email validation

      if (!emailInput) {
          alert("Please enter your email before requesting an OTP.");
          return;
      }

      if (!emailPattern.test(emailInput)) {
          alert("Invalid email format! Please enter a valid email.");
          return;
      }

      // Show OTP input & validation button
      document.getElementById("otp-section").style.display = "block";
      document.getElementById("validate-otp-btn").style.display = "inline-block";

      // Hide "Get OTP" button after clicking it
      this.style.display = "none";

      // Hide social login elements
      document.querySelectorAll(".social-text").forEach(el => el.classList.add("hidden"));
      document.querySelectorAll(".social-section").forEach(el => el.classList.add("hidden"));
  });

  document.getElementById("validate-otp-btn").addEventListener("click", function () {
      let otpInput = document.getElementById("email-otp")?.value.trim();
      let signUpBtn = document.querySelector(".sign-up-form button[type='submit']");

      if (/^\d{6}$/.test(otpInput)) {
          alert("OTP Validated!");

          // Show remaining form fields
          document.getElementById("user-details").style.display = "block";

          // ✅ Enable the Sign-Up button
          if (signUpBtn) signUpBtn.disabled = false;

          // Hide OTP input & validation button after validation
          document.getElementById("otp-section").style.display = "none";
          this.style.display = "none";
      } else {
          alert("Invalid OTP! Please enter a 6-digit OTP.");
      }
  });
});
