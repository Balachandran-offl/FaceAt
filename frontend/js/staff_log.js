const API_BASE_URL = "https://faceat1-xxs6.onrender.com";

document.getElementById("staffLoginForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    // 1. Get credentials from the login form
    const email = document.getElementById("staffEmail").value.trim();
    const password = document.getElementById("staffPass").value;

    // 2. Prepare the login data
    const loginData = {
        email: email,
        password: password
    };

    try {
        // 3. Send credentials to your login endpoint
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

        if (response.ok) {
            // 4. Check if the logged-in user is actually Staff
            if (result.user.role === "staff") {
                alert("Login Successful! Welcome, " + result.user.name);
                
                // Store a token or session info if you're using JWT
                localStorage.setItem("authToken", result.token);
                
                // Redirect to the Staff Management Dashboard
                window.location.href = "staff_dash.html";
            } else {
                alert("Access Denied: This portal is for Staff only.");
            }
        } else {
            // Show error (e.g., "Invalid password" or "User not found")
            alert("Login Failed: " + (result.message || "Invalid credentials"));
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Server connection failed. Please try again later.");
    }
});
