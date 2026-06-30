const API_BASE_URL = "https://faceat1-xxs6.onrender.com";

document.getElementById("studentLoginForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    // 1. Capture inputs
    const email = document.getElementById("studentEmail").value.trim();
    const password = document.getElementById("studentPass").value;

    const loginData = { email, password };

    try {
        // 2. Send request to backend
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

        if (response.ok) {
            // 3. Store the Token and User Info
            // This keeps the student logged in as they move between pages
            localStorage.setItem("authToken", result.token);
            localStorage.setItem("userName", result.user.name);
            localStorage.setItem("userRole", result.user.role);
            localStorage.setItem("email", result.user.email);

            alert("Login Successful! Welcome back, " + result.user.name);

            // 4. Redirect to Student Dashboard
            window.location.href = "student_dash.html";
        } else {
            // Error handling (e.g., Wrong password)
            alert("Login Failed: " + (result.message || "Invalid credentials"));
        }
    } catch (error) {
        console.error("Network Error:", error);
        alert("Unable to connect to the server. Is your backend running?");
    }
});
