const API_BASE_URL = "https://faceat1-xxs6.onrender.com";

// ADDED 'async' HERE
document.getElementById("studentRegForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const name = document.getElementById("studentName").value.trim();
    const email = document.getElementById("studentEmail").value.trim();
    const password = document.getElementById("studentPass").value;
    const confirm_password = document.getElementById("studentConfirmPass").value;

    if (password !== confirm_password) {
        alert("Registration Failed: Passwords do not match.");
        document.getElementById("studentConfirmPass").value = '';
        document.getElementById("studentConfirmPass").focus();
        return;
    }

    if (password.length < 8) {
        alert("Security Tip: Your password should be at least 8 characters long.");
        return;
    }

    const studentData = {
        name: name,
        email: email,
        password: password,
        role: "student", 
        registrationDate: new Date().toISOString()
    };

    try {
        // FIXED: headers (plural) and the object format
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(studentData)
        });

        const result = await response.json();

        if (response.ok) {
            alert("Registration Successful!");
            window.location.href = "student_log.html";
        } else {
            // Show error from backend (like "User already exists")
            alert("Error: " + (result.message || "Unknown error occurred"));
        }
    } catch (error) {
        console.error("Connection Error:", error);
        alert("Could not connect to the server. Check if your backend is running.");
    }
});
