const API_BASE_URL = "https://faceatt1.onrender.com";

document.addEventListener('DOMContentLoaded', () => {
    setupDashboardNavigation();
    setupLogout();
    setupVerificationModule();
    setupAttendanceModule();
});

const decisionLocks = new Set();
let currentVerificationView = 'pending';

function setupDashboardNavigation() {
    const attendanceNav = document.getElementById('btn-attendance-nav');
    const verifyNav = document.getElementById('btn-verify-nav');
    const attendanceSection = document.getElementById('attendance-section');
    const verificationSection = document.getElementById('verification-section');
    const headerTitle = document.querySelector('.header-title');
    const navItems = [attendanceNav, verifyNav].filter(Boolean);

    function setActiveNav(activeItem) {
        navItems.forEach(item => item.classList.remove('active'));
        if (activeItem) activeItem.classList.add('active');
    }

    function showAttendanceSection(activeItem = attendanceNav) {
        if (attendanceSection) attendanceSection.classList.remove('section-hidden');
        if (verificationSection) verificationSection.classList.add('section-hidden');
        if (headerTitle) headerTitle.innerText = 'Take Attendance';
        setActiveNav(activeItem);
    }

    function showVerificationSection() {
        if (attendanceSection) attendanceSection.classList.add('section-hidden');
        if (verificationSection) verificationSection.classList.remove('section-hidden');
        if (headerTitle) headerTitle.innerText = 'Verify Image';
        setActiveNav(verifyNav);
    }

    if (attendanceNav) {
        attendanceNav.addEventListener('click', (event) => {
            event.preventDefault();
            showAttendanceSection(attendanceNav);
        });
    }

    if (verifyNav) {
        verifyNav.addEventListener('click', (event) => {
            event.preventDefault();
            showVerificationSection();
        });
    }

    showAttendanceSection(attendanceNav);
}

function setupVerificationModule() {
    const pendingQueueBtn = document.getElementById('pendingQueueBtn');
    const approvedQueueBtn = document.getElementById('approvedQueueBtn');

    if (!pendingQueueBtn || !approvedQueueBtn) return;

    pendingQueueBtn.addEventListener('click', () => {
        if (currentVerificationView === 'pending') return;
        currentVerificationView = 'pending';
        updateVerificationViewButtons();
        updateVerificationQueueMessage();
        refreshVerificationSection();
    });

    approvedQueueBtn.addEventListener('click', () => {
        if (currentVerificationView === 'approved') return;
        currentVerificationView = 'approved';
        updateVerificationViewButtons();
        updateVerificationQueueMessage();
        refreshVerificationSection();
    });

    updateVerificationViewButtons();
    updateVerificationQueueMessage();
    refreshVerificationSection();
}

function updateVerificationViewButtons() {
    const pendingQueueBtn = document.getElementById('pendingQueueBtn');
    const approvedQueueBtn = document.getElementById('approvedQueueBtn');

    if (pendingQueueBtn) {
        pendingQueueBtn.classList.toggle(
            'active',
            currentVerificationView === 'pending'
        );
    }

    if (approvedQueueBtn) {
        approvedQueueBtn.classList.toggle(
            'active',
            currentVerificationView === 'approved'
        );
    }
}

function updateVerificationQueueMessage() {
    const queueMessage = document.getElementById('verificationQueueMessage');
    if (!queueMessage) return;

    queueMessage.innerText = currentVerificationView === 'pending'
        ? 'Review the following student profile photos. These have passed InsightFace quality checks.'
        : 'View the approved student profile photos along with their roll numbers.';
}

async function fetchVerificationImages(view) {
    const endpoint = view === 'approved'
        ? `${API_BASE_URL}/api/staff/approved-verification`
        : `${API_BASE_URL}/api/staff/pending-verification`;

    const response = await fetch(endpoint);
    if (!response.ok) {
        throw new Error(`Unable to fetch ${view} verification images.`);
    }

    return response.json();
}

async function refreshVerificationSection() {
    const gridContainer = document.getElementById('student-image-grid');
    const pendingCount = document.getElementById('pending-count');
    const approvedCount = document.getElementById('approved-count');

    if (!gridContainer) return;

    try {
        const [pendingStudents, approvedStudents] = await Promise.all([
            fetchVerificationImages('pending'),
            fetchVerificationImages('approved')
        ]);

        if (pendingCount) {
            pendingCount.innerText = pendingStudents.length;
        }

        if (approvedCount) {
            approvedCount.innerText = approvedStudents.length;
        }

        const students = currentVerificationView === 'approved'
            ? approvedStudents
            : pendingStudents;

        if (students.length === 0) {
            gridContainer.innerHTML = `
                <p class="verification-meta" style="text-align:center; width:100%; padding:20px;">
                    ${currentVerificationView === 'approved'
                        ? 'No approved images are available yet.'
                        : 'No images are pending verification.'}
                </p>`;
            return;
        }

        gridContainer.innerHTML = '';
        students.forEach(student => {
            const card = createStudentCard(student, currentVerificationView);
            gridContainer.appendChild(card);
        });
    } catch (error) {
        console.error('Error fetching students:', error);
        gridContainer.innerHTML = `
            <p class="verification-meta" style="text-align:center; width:100%; padding:20px;">
                Unable to load verification images right now.
            </p>`;
    }
}

function createStudentCard(student, view = 'pending') {
    const card = document.createElement('div');
    card.className = 'verification-card';
    card.dataset.rollNumber = student.rollNumber;

    const base64String = btoa(new Uint8Array(student.image.data.data).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    const imgSrc = `data:${student.image.contentType};base64,${base64String}`;
    const isProcessing = Boolean(student.processingAccept);
    const qualityScore = Number(student.qualityScore || 0);

    if (view === 'approved') {
        card.innerHTML = `
            <div class="verification-image-frame">
                <img src="${imgSrc}" alt="Approved image for ${student.rollNumber}" class="verification-image">
            </div>
            <h4>Roll No: ${student.rollNumber}</h4>`;

        return card;
    }

    card.innerHTML = `
        <div class="verification-image-frame">
            <img src="${imgSrc}" alt="Student image for ${student.rollNumber}" class="verification-image">
        </div>
        <h4>Roll No: ${student.rollNumber}</h4>
        <p class="verification-score">
            Quality Score: ${Math.round(qualityScore * 100)}%
        </p>
        <div class="decision-actions">
            <button type="button" class="btn-upload decision-btn accept-btn" data-action="accept">Accept</button>
            <button type="button" class="btn-upload decision-btn reject-btn" data-action="reject">Reject</button>
        </div>
        <p class="decision-status" ${isProcessing ? '' : 'hidden'}>
            Embedding generation is in progress. Please wait.
        </p>`;

    const actionButtons = card.querySelectorAll('.decision-btn');
    actionButtons.forEach((button) => {
        button.addEventListener('click', () => {
            processDecision(student.rollNumber, button.dataset.action, button);
        });
    });

    if (isProcessing) {
        setDecisionCardState(card, true, 'accept', 'Embedding generation is in progress. Please wait.');
    }

    return card;
}

function setDecisionCardState(card, isProcessing, action, message = '') {
    if (!card) return;

    card.dataset.processing = String(isProcessing);

    const acceptButton = card.querySelector('[data-action="accept"]');
    const rejectButton = card.querySelector('[data-action="reject"]');
    const status = card.querySelector('.decision-status');

    if (acceptButton) {
        acceptButton.disabled = isProcessing;
        acceptButton.innerText = isProcessing && action === 'accept'
            ? 'Generating...'
            : 'Accept';
    }

    if (rejectButton) {
        rejectButton.disabled = isProcessing;
        rejectButton.innerText = isProcessing && action === 'reject'
            ? 'Rejecting...'
            : 'Reject';
    }

    if (status) {
        status.hidden = !message;
        status.innerText = message;
    }
}

async function processDecision(rollNumber, action, triggerButton) {
    const card = triggerButton?.closest('.verification-card');

    if (decisionLocks.has(rollNumber) || card?.dataset.processing === 'true') {
        return;
    }

    if (!confirm(`Are you sure you want to ${action} this image?`)) return;

    decisionLocks.add(rollNumber);
    setDecisionCardState(
        card,
        true,
        action,
        action === 'accept'
            ? 'Embedding generation is in progress. Please wait.'
            : 'Rejecting image. Please wait.'
    );

    try {
        const response = await fetch(`${API_BASE_URL}/api/staff/verify-decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rollNumber, action })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            if (response.status === 409) {
                await refreshVerificationSection();
            }

            throw new Error(result.message || `Unable to ${action} this image.`);
        }

        alert(result.message || `Student ${rollNumber} has been ${action}ed.`);
        await refreshVerificationSection();
    } catch (error) {
        console.error("Verification error:", error);
        alert(error.message || 'Verification request failed.');
        setDecisionCardState(card, false, action);
    } finally {
        decisionLocks.delete(rollNumber);
    }
}

function setupLogout() {
    const staffLogoutBtn = document.getElementById('staffLogoutBtn');
    if (!staffLogoutBtn) return;

    staffLogoutBtn.addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.clear();
        window.location.href = 'staff_log.html';
    });
}

function setupAttendanceModule() {
    const classroomInput = document.getElementById('classroomImage');
    const fileNameLabel = document.getElementById('classroomFileName');
    const previewImage = document.getElementById('classroomPreviewImage');
    const previewPlaceholder = document.getElementById('classroomPreviewPlaceholder');
    const processBtn = document.getElementById('processAttendanceBtn');
    const presentViewBtn = document.getElementById('presentViewBtn');
    const absentViewBtn = document.getElementById('absentViewBtn');
    const presentList = document.getElementById('presentStudentsList');
    const absentList = document.getElementById('absentStudentsList');
    const presentCount = document.getElementById('presentCount');
    const absentCount = document.getElementById('absentCount');
    const presentColumn = document.querySelector('.present-column');
    const absentColumn = document.querySelector('.absent-column');

    if (!classroomInput || !processBtn) return;

    let selectedFile = null;
    let currentView = 'present';

    processBtn.disabled = true;
    clearAttendanceResults();

    classroomInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload only JPG, JPEG, or PNG images.');
            resetAttendanceSelection();
            return;
        }

        selectedFile = file;
        fileNameLabel.innerText = file.name;
        processBtn.disabled = false;

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            previewImage.src = loadEvent.target.result;
            previewImage.style.display = 'block';
            previewPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);

        clearAttendanceResults();
    });

    processBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            alert('Please choose a classroom image first.');
            return;
        }

        const originalButtonText = processBtn.innerText;
        processBtn.disabled = true;
        processBtn.innerText = 'Processing...';

        try {
            const result = await sendAttendanceRequest(selectedFile);
            const presentStudents = normalizeStudentList(
                result.presentStudents || result.present || result.present_students
            );
            const absentStudents = normalizeStudentList(
                result.absentStudents || result.absent || result.absent_students
            );

            renderAttendanceList(
                presentList,
                presentStudents,
                'No present students were matched.'
            );
            renderAttendanceList(
                absentList,
                absentStudents,
                'No absent students were found.'
            );

            presentCount.innerText = presentStudents.length;
            absentCount.innerText = absentStudents.length;

            setAttendanceView(currentView, {
                presentViewBtn,
                absentViewBtn,
                presentColumn,
                absentColumn
            });

            const resultsSection = document.getElementById('attendance-results');
            if (resultsSection) {
                resultsSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        } catch (error) {
            console.error('Attendance processing error:', error);
            alert(error.message || 'Unable to process attendance.');
        } finally {
            processBtn.disabled = false;
            processBtn.innerText = originalButtonText;
        }
    });

    if (presentViewBtn) {
        presentViewBtn.addEventListener('click', () => {
            currentView = 'present';
            setAttendanceView(currentView, {
                presentViewBtn,
                absentViewBtn,
                presentColumn,
                absentColumn
            });
        });
    }

    if (absentViewBtn) {
        absentViewBtn.addEventListener('click', () => {
            currentView = 'absent';
            setAttendanceView(currentView, {
                presentViewBtn,
                absentViewBtn,
                presentColumn,
                absentColumn
            });
        });
    }

    window.addEventListener('resize', () => {
        setAttendanceView(currentView, {
            presentViewBtn,
            absentViewBtn,
            presentColumn,
            absentColumn
        });
    });

    setAttendanceView(currentView, {
        presentViewBtn,
        absentViewBtn,
        presentColumn,
        absentColumn
    });

    function resetAttendanceSelection() {
        classroomInput.value = '';
        selectedFile = null;
        fileNameLabel.innerText = 'No image selected';
        processBtn.disabled = true;
        previewImage.src = '';
        previewImage.style.display = 'none';
        previewPlaceholder.style.display = 'flex';
        clearAttendanceResults();
    }

    function clearAttendanceResults() {
        renderAttendanceList(
            presentList,
            [],
            'Present roll numbers will appear here after processing.'
        );
        renderAttendanceList(
            absentList,
            [],
            'Absent roll numbers will appear here after processing.'
        );
        presentCount.innerText = '0';
        absentCount.innerText = '0';
    }
}

async function sendAttendanceRequest(file) {
    const attendanceApiUrl = `${API_BASE_URL}/api/staff/process-attendance`;
    const formData = new FormData();
    formData.append('classroomImage', file);

    const token = localStorage.getItem('authToken');
    const headers = {};

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let response;
    try {
        response = await fetch(attendanceApiUrl, {
            method: 'POST',
            headers,
            body: formData
        });
    } catch (error) {
        throw new Error('Could not connect to the attendance service.');
    }

    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Attendance API route not found. Add /api/staff/process-attendance in the backend.');
        }
        throw new Error(data.message || 'Server error while processing attendance.');
    }

    return data;
}

function normalizeStudentList(list) {
    if (!Array.isArray(list)) return [];

    return list
        .map((item) => {
            if (typeof item === 'string' || typeof item === 'number') {
                return String(item).trim();
            }

            if (item && typeof item === 'object') {
                return String(
                    item.rollNumber ||
                    item.roll_no ||
                    item.registerNumber ||
                    item.name ||
                    ''
                ).trim();
            }

            return '';
        })
        .filter(Boolean);
}

function renderAttendanceList(container, students, emptyMessage) {
    if (!container) return;

    container.innerHTML = '';

    if (students.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'student-pill placeholder-pill';
        placeholder.innerText = emptyMessage;
        container.appendChild(placeholder);
        return;
    }

    students.forEach((student) => {
        const pill = document.createElement('div');
        pill.className = 'student-pill';
        pill.innerText = student;
        container.appendChild(pill);
    });
}

function setAttendanceView(view, elements) {
    const { presentViewBtn, absentViewBtn, presentColumn, absentColumn } = elements;
    const showPresent = view === 'present';
    const compactView = window.innerWidth <= 1080;

    if (presentViewBtn) {
        presentViewBtn.classList.toggle('active', showPresent);
    }

    if (absentViewBtn) {
        absentViewBtn.classList.toggle('active', !showPresent);
    }

    if (!presentColumn || !absentColumn) return;

    if (compactView) {
        presentColumn.style.display = showPresent ? 'block' : 'none';
        absentColumn.style.display = showPresent ? 'none' : 'block';
        presentColumn.style.opacity = '1';
        absentColumn.style.opacity = '1';
        return;
    }

    presentColumn.style.display = 'block';
    absentColumn.style.display = 'block';
    presentColumn.style.opacity = showPresent ? '1' : '0.55';
    absentColumn.style.opacity = showPresent ? '0.55' : '1';
}
