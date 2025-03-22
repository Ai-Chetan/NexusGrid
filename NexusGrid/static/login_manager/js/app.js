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
  const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

  fetch('/get-otp/', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken
      },
      body: JSON.stringify({ email: email })
  })
  .then(response => response.json())
  .then(data => {
      if (data.success) {
          // ✅ Show modal properly
          let otpModal = new bootstrap.Modal(document.getElementById("otpModal"));
          otpModal.show();
          
          console.log("OTP sent successfully!");
      } else {
          console.error("Error:", data.message);
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
          alert("✅ OTP Verified!","Account Created Successfully! Redirecting to Login Page...");
          window.location.href = "/login/";
          let otpModal = bootstrap.Modal.getInstance(document.getElementById("otpModal"));
          otpModal.hide();  // Close modal after success
      } else {
          document.getElementById("otpError").classList.remove("d-none");  // Show error
          document.getElementById("otpError").innerText = data.message;
      }
  })
  .catch(error => console.error("Error:", error));
});