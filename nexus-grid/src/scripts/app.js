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

/* Validate Fields before Submit and prompt to Dashboard */
document.addEventListener("DOMContentLoaded", function () {
  // Form and elements
  const form = document.getElementById("signin-form");
  const usernameInput = document.getElementById("signin-username");
  const passwordInput = document.getElementById("signin-password");
  const togglePasswordButton = document.getElementById("toggle-password-signin");

  // Handle form submission
  form.addEventListener("submit", function (event) {
      event.preventDefault(); // Prevent the form from submitting normally

      const username = usernameInput.value;
      const password = passwordInput.value;

      window.location.href = "/dashboard"; // This redirects to the /dashboard route (React app)
  });

  // Toggle password visibility
  togglePasswordButton.addEventListener("click", function () {
      if (passwordInput.type === "password") {
          passwordInput.type = "text";
          togglePasswordButton.innerHTML = '<i class="fa-solid fa-eye"></i>'; // Change icon to show
      } else {
          passwordInput.type = "password";
          togglePasswordButton.innerHTML = '<i class="fa-solid fa-eye-slash"></i>'; // Change icon to hide
      }
  });
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
document.getElementById("get-otp-btn").addEventListener("click", function (event) {
  event.preventDefault(); // Prevent form submission

  let emailInput = document.getElementById("signup-email").value.trim();
  let emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Basic email format check

  if (!emailPattern.test(emailInput)) {
      alert("Please enter a valid email before requesting an OTP.");
      return;
  }

  document.getElementById("otp-section").style.display = "block";
  document.getElementById("validate-otp-btn").style.display = "inline-block";

  // Hide "Get OTP" button after clicking it
  this.style.display = "none";
});

document.getElementById("validate-otp-btn").addEventListener("click", function () {
  let otpInput = document.getElementById("email-otp").value.trim();
  
  // OTP must be exactly 6 digits (adjust based on your actual OTP format)
  if (/^\d{6}$/.test(otpInput)) {  
      alert("OTP Validated!");

      // Show remaining form fields
      document.getElementById("user-details").style.display = "block";
      document.getElementById("signup-btn").disabled = false;

      // Hide OTP input & validation button after validation
      document.getElementById("otp-section").style.display = "none";
      this.style.display = "none";
  } else {
      alert("Invalid OTP! Please enter a 6-digit OTP.");
  }
});