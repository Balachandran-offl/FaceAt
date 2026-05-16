document.addEventListener('DOMContentLoaded', () => {
    setupDashboardNavigation();
    setupAttendanceModule();
    fetchPendingImages();
    updateApprovedCount();
});

function setupDashboardNavigation() {
    const attendanceNav = document.getElementById('btn-attendance-nav');
    const verifyNav = document.getElementById('btn-verify-nav');
    const studentListNav = document.getElementById('btn-student-list-nav');
    const attendanceSection = document.getElementById('attendance-section');
    const verificationSection = document.getElementById('verification-section');
    const headerTitle = document.querySelector('.header-title');
    const navItems = [attendanceNav, verifyNav, studentListNav].filter(Boolean);

    function setActiveNav(activeItem) {
        navItems.forEach(item => item.classList.remove('active'));
        if (activeItem) activeItem.classList.add('active');
    }

    function showAttendanceSection(activeItem = attendanceNav, scrollToResults = false) {
        if (attendanceSection) attendanceSection.classList.remove('section-hidden');
        if (verificationSection) verificationSection.classList.add('section-hidden');
        if (headerTitle) headerTitle.innerText = 'Take Attendance';
        setActiveNav(activeItem);

        if (scrollToResults) {
            const resultsSection = document.getElementById('attendance-results');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
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

    if (studentListNav) {
        studentListNav.addEventListener('click', (event) => {
            event.preventDefault();
            showAttendanceSection(studentListNav, true);
        });
    }

    showAttendanceSection(attendanceNav);
}

async function updateApprovedCount() {
    const approvedDisplay = document.getElementById('approved-count'); // Make sure this ID exists in HTML
    try {
        const response = await fetch('http://localhost:5000/api/staff/approved-stats');
        const data = await response.json();
        
        if (approvedDisplay) {
            approvedDisplay.innerText = data.count;
        }
    } catch (error) {
        console.error("Error fetching approved count:", error);
    }
}
async function fetchPendingImages() {
    const gridContainer = document.getElementById('student-image-grid');
    const pendingCount = document.getElementById('pending-count');
    
    try {
        const response = await fetch('http://localhost:5000/api/staff/pending-verification');
        const students = await response.json();
        
        pendingCount.innerText = students.length;
        
        if (students.length === 0) {
            gridContainer.innerHTML = '<p style="text-align:center; width:100%; padding:20px;">No images pending verification.</p>';
            return;
        }
        
        gridContainer.innerHTML = '';
        students.forEach(student => {
            const card = createStudentCard(student);
            gridContainer.appendChild(card);
        });
    } catch (error) {
        console.error("Error fetching students:", error);
    }
}

function createStudentCard(student) {
    const card = document.createElement('div');
    card.style.cssText = "background: var(--bg-body); padding: 15px; border-radius: 12px; border: 1px solid var(--border-soft); text-align: center;";
    
    // Fix: String.fromCharCode (added 'h')
    const base64String = btoa(new Uint8Array(student.image.data.data).reduce((data, byte) => data + String.fromCharCode(byte), ''));
    const imgSrc = `data:${student.image.contentType};base64,${base64String}`;
    
    card.innerHTML = `
        <img src="${imgSrc}" style="width: 100%; border-radius: 8px; margin-bottom: 10px; height: 180px; object-fit: cover; object-position: top;">
        <h4 style="color: #4e4e4e; margin-bottom: 5px;">Roll No: ${student.rollNumber}</h4>
        <p style="font-size: 0.8rem; font-weight: 800; color: var(--primary-blue); margin-bottom: 15px;">
            Quality Score: ${Math.round(student.qualityScore * 100)}%
        </p>
        <div style="display: flex; gap: 10px;">
            <button class="btn-upload" style="flex: 1; background: var(--success-green); padding: 8px;" 
                onclick="processDecision('${student.rollNumber}', 'accept')">Accept</button>
            <button class="btn-upload" style="flex: 1; background: var(--danger-red); padding: 8px;" 
                onclick="processDecision('${student.rollNumber}', 'reject')">Reject</button>
        </div>`;
    return card;
}

// Moved outside so the 'onclick' in the HTML can find it
async function processDecision(rollNumber, action) {
    if (!confirm(`Are you sure you want to ${action} this image?`)) return;
    try {
        const response = await fetch('http://localhost:5000/api/staff/verify-decision', { // Ensure this endpoint matches your backend
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // Fix: headers (plural)
            body: JSON.stringify({ rollNumber, action })
        });
        
        const result = await response.json();
        if (result.success) {
            alert(`Student ${rollNumber} has been ${action}ed.`);
            fetchPendingImages(); 
            updateApprovedCount();// Refresh the grid
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        console.error("Verification error:", error);
    }
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
    const attendanceApiUrl = 'http://localhost:5000/api/staff/process-attendance';
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
