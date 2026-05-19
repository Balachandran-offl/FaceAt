document.addEventListener('DOMContentLoaded', () => {
    const studentPhoto = document.getElementById('studentPhoto');
    const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const fileSelected = document.getElementById('fileSelectedName');
    const feedback = document.getElementById('statusFeedback');
    const previewImg = document.getElementById('imagePreview');
    const previewCont = document.getElementById('previewContainer');
    const uploadBox = document.getElementById('uploadStatusBox');
    const uploadText = document.getElementById('uploadStatusText');
    const verifyBox = document.getElementById('verifyStatusBox');
    const verifyText = document.getElementById('verifyStatusText');

    if (!studentPhoto || !uploadTriggerBtn || !analyzeBtn || !fileSelected || !feedback) {
        console.error('Student dashboard upload controls are missing.');
        return;
    }

    let selectedFile = null;

    checkCurrentStatus();

    uploadTriggerBtn.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        if (typeof studentPhoto.showPicker === 'function') {
            studentPhoto.showPicker();
            return;
        }

        studentPhoto.click();
    });

    studentPhoto.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            showFeedback('Invalid format. Please upload JPG or PNG.', 'red');
            resetUpload();
            return;
        }

        selectedFile = file;
        fileSelected.innerText = `Selected: ${file.name}`;
        analyzeBtn.disabled = false;
        showFeedback('Photo selected. Click Analyze to check quality.', '#4e73df');

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            previewImg.src = loadEvent.target.result;
            previewCont.classList.add('is-visible');
        };
        reader.readAsDataURL(file);
    });

    analyzeBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            showFeedback('Please choose a photo first.', 'orange');
            return;
        }

        showFeedback('Analyzing...', '#4e73df');
        await verifyImageQuality(selectedFile);
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'student_log.html';
        });
    }

    async function verifyImageQuality(file) {
        const formData = new FormData();
        formData.append('profileImage', file);

        const token = localStorage.getItem('authToken');
        if (!token) {
            showFeedback('Session expired. Please login again.', 'red');
            window.location.href = 'student_log.html';
            return;
        }

        try {
            const response = await fetch('/api/quality/verify-quality', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Server responded with an error');
            }

            const result = await response.json();

            if (result.qualityScore >= 0.8) {
                const percentage = Math.round(result.qualityScore * 100);
                showFeedback(`Quality Score: ${percentage}%. Image accepted!`, '#1cc88a');
                checkCurrentStatus();
                return;
            }

            showFeedback(
                'Image too blurry or face not clear. Please upload a better photo.',
                'orange'
            );
            resetUpload();
        } catch (error) {
            console.error('Fetch Error:', error);
            showFeedback('Connection error. Ensure backend is running.', 'red');
        }
    }

    async function checkCurrentStatus() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            return;
        }

        try {
            const response = await fetch('/api/staff/student-status', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (data.exists) {
                uploadBox.style.borderLeftColor = '#fd7e14';
                uploadText.innerText = 'Image Uploaded';
                uploadText.style.color = '#fd7e14';

                if (data.verified) {
                    verifyBox.style.borderLeftColor = 'var(--success-green)';
                    verifyText.innerText = 'Verified';
                    verifyText.style.color = 'var(--success-green)';
                    return;
                }

                verifyBox.style.borderLeftColor = 'var(--danger-red)';
                verifyText.innerText = 'Pending Approval';
                verifyText.style.color = 'var(--danger-red)';
                return;
            }

            uploadBox.style.borderLeftColor = '#858796';
            uploadText.innerText = 'Image Not Uploaded';
            uploadText.style.color = '#858796';

            verifyBox.style.borderLeftColor = 'var(--danger-red)';
            verifyText.innerText = 'Not Verified';
            verifyText.style.color = 'var(--danger-red)';
        } catch (error) {
            console.error('Status Update Error:', error);
        }
    }

    function showFeedback(text, color) {
        feedback.innerText = text;
        feedback.style.color = color;
    }

    function resetUpload() {
        studentPhoto.value = '';
        fileSelected.innerText = '';
        previewCont.classList.remove('is-visible');
        previewImg.src = '';
        selectedFile = null;
        analyzeBtn.disabled = true;
    }
});
