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

function getOTP() {
  const email = document.getElementById("signup-email").value;
  const username = document.getElementById("signup-username").value;
  const password = document.getElementById("signup-password").value;
  const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

  fetch('/get-otp/', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken
      },
      body: JSON.stringify({ email: email, username: username, password: password })
  })
  .then(response => response.json())
  .then(data => {
      if (data.success) {
          let otpModal = new bootstrap.Modal(document.getElementById("otpModal"));
          otpModal.show();
          console.log("OTP sent successfully!");
      } else {
          alert(data.message); // Show error message
      }
  })
  .catch(error => console.error("Request failed:", error));
}

document.getElementById("verifyOtpBtn").addEventListener("click", function () {
  const otpInput = document.getElementById("otpInput").value;
  const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

  fetch('/verify-otp/', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken
      },
      body: JSON.stringify({ otp: otpInput })
  })
  .then(response => response.json())
  .then(data => {
      if (data.success) {
          alert("✅ OTP Verified! Account Created Successfully! Redirecting to Login Page...");
          window.location.href = "/login/";
      } else {
          document.getElementById("otpError").classList.remove("d-none");
          document.getElementById("otpError").innerText = data.message;
      }
  })
  .catch(error => console.error("Error:", error));
});

/* Sign In Validation */
document.getElementById("login-button").addEventListener("click", function (event) {
  event.preventDefault();
  const username = document.getElementById("signin-username").value.trim();
  const password = document.getElementById("signin-password").value.trim();
  const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

  fetch('/user-login/', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken
      },
      body: JSON.stringify({ username: username, password: password })
  })
  .then(response => response.json())
  .then(data => {
      if (data.success) {
          alert("✅ Login Successful! Redirecting...");
          window.location.href = data.redirect_url;  // Redirect on success
      } else {
          alert(data.message);  // Show error message
      }
  })
  .catch(error => console.error("Login request failed:", error));
});