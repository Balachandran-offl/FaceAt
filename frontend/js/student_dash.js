document.addEventListener('DOMContentLoaded', () => {
    // 1. Elements Selection
    setupAttendenceModule();
    const studentPhoto = document.getElementById('studentPhoto');
    const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const fileSelected = document.getElementById('fileSelectedName');
    const feedback = document.getElementById('statusFeedback');
    
    // Preview Elements
    const previewImg = document.getElementById('imagePreview');
    const previewCont = document.getElementById('previewContainer');

    // Status Box Elements
    const uploadBox = document.getElementById('uploadStatusBox');
    const uploadText = document.getElementById('uploadStatusText');
    const verifyBox = document.getElementById('verifyStatusBox');
    const verifyText = document.getElementById('verifyStatusText');

    // --- INITIAL CHECK ---
    // Runs when the page opens to see if the user already has a photo
    checkCurrentStatus();

    // 2. Trigger File Selection
    uploadTriggerBtn.addEventListener('click', () => {
        studentPhoto.click();
    });

    let selectedFile = null;

    // 3. Handle File Selection (preview only)
    studentPhoto.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation: Format Check
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            showfeedback("❌ Invalid format. Please upload JPG or PNG.", "red");
            resetUpload();
            return;
        }

        // Action: Show Image Preview
        const reader = new FileReader();
        reader.onload = function(event) {
            previewImg.src = event.target.result;
            previewCont.style.display = 'block';
        };
        reader.readAsDataURL(file);

        // Update UI
        fileSelected.innerText = `Selected: ${file.name}`;
        showfeedback("Photo selected. Click Analyze to check quality.", "#4e73df");
        selectedFile = file;
        if (analyzeBtn) analyzeBtn.disabled = false;
    });

    // 4. Analyze Button Click
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            if (!selectedFile) {
                showfeedback("Please choose a photo first.", "orange");
                return;
            }
            showfeedback("🔍 Analyzing image quality with RetinaFace...", "#4e73df");
            await verifyImageQuality(selectedFile);
        });
    }

    // 5. API Communication & Quality Verification
    async function verifyImageQuality(file) {
        const formdata = new FormData();
        formdata.append("profileImage", file);
        
        const token = localStorage.getItem("authToken");
        if (!token) {
            showfeedback("Session expired. Please login again.", "red");
            window.location.href = "student_log.html";
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/quality/verify-quality', {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formdata
            });

            if (!response.ok) throw new Error("Server responded with an error");

            const result = await response.json();

            // Threshold Check (0.8 / 80%)
            if (result.qualityScore >= 0.8) {
                const percentage = Math.round(result.qualityScore * 100);
                showfeedback(`✅ Quality Score: ${percentage}%. Image Accepted!`, "#1cc88a");
                
                // ⭐ UPDATE DASHBOARD STATUS IMMEDIATELY AFTER UPLOAD
                checkCurrentStatus(); 
            } else {
                showfeedback("⚠️ Image too blurry or face not clear. Please upload a better photo.", "orange");
                studentPhoto.value = ""; 
            }
        } catch (error) {
            console.error("Fetch Error:", error);
            showfeedback("❌ Connection error. Ensure backend is running.", "red");
        }
    }

    // --- NEW: STATUS CHECKER LOGIC ---
    async function checkCurrentStatus() {
        const token = localStorage.getItem("authToken");
        if (!token) return;

        try {
            const response = await fetch('http://localhost:5000/api/staff/student-status', {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (data.exists) {
                // 1. Update Upload Box to Orange
                uploadBox.style.borderLeftColor = "#fd7e14"; 
                uploadText.innerText = "Image Uploaded";
                uploadText.style.color = "#fd7e14";

                // 2. Update Verification Box
                if (data.verified) {
                    verifyBox.style.borderLeftColor = "var(--success-green)";
                    verifyText.innerText = "Verified";
                    verifyText.style.color = "var(--success-green)";
                } else {
                    verifyBox.style.borderLeftColor = "var(--danger-red)";
                    verifyText.innerText = "Pending Approval";
                    verifyText.style.color = "var(--danger-red)";
                }
            } else {
                // Keep default state if no image exists
                uploadBox.style.borderLeftColor = "#858796";
                uploadText.innerText = "Image Not Uploaded";
                uploadText.style.color = "#858796";

                verifyBox.style.borderLeftColor = "var(--danger-red)";
                verifyText.innerText = "Not Verified";
                verifyText.style.color = "var(--danger-red)";
            }
        } catch (err) {
            console.error("Status Update Error:", err);
        }
    }

    // 6. Helper Functions
    function showfeedback(text, color) {
        feedback.innerText = text;
        feedback.style.color = color;
    }

    function resetUpload() {
        studentPhoto.value = "";
        fileSelected.innerText = "";
        previewCont.style.display = 'none';
        previewImg.src = "";
        selectedFile = null;
        if (analyzeBtn) analyzeBtn.disabled = true;
    }

    // 7. Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'student_log.html';
        });
    }
    const uploadimage=document.getElementById("attendence-section")
});
function setupAttendenceModule(){
    const classrominput=document.getElementByID("classroomImage");
}
