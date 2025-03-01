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


/*Navbar Toggle Logic*/
function toggleMenu() {
  const nav = document.getElementById('navLinks');
  const menuIcon = document.querySelector('.menu-icon');
  if (nav.classList.contains('open')) {
      nav.classList.remove('open');
      menuIcon.innerHTML = "&#9776;";
  } else {
      nav.classList.add('open');
      menuIcon.innerHTML = "&#10006;";
  }
}

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
document.getElementById("get-otp-btn").addEventListener("click", function () {
  document.getElementById("otp-section").style.display = "block";
  document.getElementById("validate-otp-btn").style.display = "inline-block";

  // Hide "Get OTP" button after clicking it
  this.style.display = "none";
});

document.getElementById("validate-otp-btn").addEventListener("click", function () {
  let otpInput = document.getElementById("email-otp").value;
  
  // Simulating OTP validation 
  if (otpInput.length === 6) {  // Need to add OTP validation logic here
      alert("OTP Validated!");

      // Show remaining form fields
      document.getElementById("user-details").style.display = "block";
      document.getElementById("signup-btn").disabled = false;

      // Hide OTP input & validation button after validation
      document.getElementById("otp-section").style.display = "none";
      this.style.display = "none";
  } else {
      alert("Invalid OTP! Please enter the correct OTP.");
  }
});