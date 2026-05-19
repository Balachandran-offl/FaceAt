document.getElementById("staffRegForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    // 1. Fetch values using the IDs from your staff_reg.html
    const name = document.getElementById("staffName").value.trim();
    const email = document.getElementById("staffEmail").value.trim();
    const password = document.getElementById("staffPass").value;
    const confirm_password = document.getElementById("staffConfirmPass").value;

    // 2. Validation
    if (password !== confirm_password) {
        alert("Staff Registration Failed: Passwords do not match.");
        document.getElementById("staffConfirmPass").value = '';
        document.getElementById("staffConfirmPass").focus();
        return;
    }

    if (password.length < 8) {
        alert("Security Requirement: Staff passwords must be at least 8 characters.");
        return;
    }

    // 3. Package Data
    const staffData = {
        name: name,
        email: email,
        password: password,
        role: "staff", // Hardcoded as staff for this form
        registrationDate: new Date().toISOString()
    };

    // 4. Send to Backend
    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(staffData)
        });

        const result = await response.json();

        if (response.ok) {
            alert("Staff Registration Successful! Welcome aboard.");
            window.location.href = "staff_log.html";
        } else {
            alert("Error: " + (result.message || "Registration failed"));
        }
    } catch (error) {
        console.error("Connection Error:", error);
        alert("Could not connect to the server. Please ensure the backend is active.");
    }
});
