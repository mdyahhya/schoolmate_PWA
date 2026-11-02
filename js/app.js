// OpenSoftwares Admin PWA Logic
document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentSchools = [];
  let currentStaff = [];
  let currentStudents = [];
  let currentFeed = [];
  let currentBuses = [];
  let verifiedYoutubeData = null;
  let deferredPrompt = null;

  // DOM Elements
  const authOverlay = document.getElementById('authOverlay');
  const authForm = document.getElementById('authForm');
  const adminPassInput = document.getElementById('adminPass');
  const authError = document.getElementById('authError');
  const btnLogout = document.getElementById('btnLogout');
  const btnInstallPwa = document.getElementById('btnInstallPwa');

  // Navigation
  const navTabs = document.querySelectorAll('.nav-tab');
  const panels = {
    schools: document.getElementById('panelSchools'),
    staff: document.getElementById('panelStaff'),
    students: document.getElementById('panelStudents'),
    feed: document.getElementById('panelFeed'),
    fleet: document.getElementById('panelFleet')
  };

  // -------------------------------------------------------------
  // 1. AUTHENTICATION (#flutter / Vercel PASS)
  // -------------------------------------------------------------
  const checkAuth = () => {
    const isAuthed = sessionStorage.getItem('os_admin_authenticated') === 'true';
    if (isAuthed) {
      authOverlay.style.display = 'none';
      loadAllData();
    } else {
      authOverlay.style.display = 'flex';
      adminPassInput.focus();
    }
  };

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = adminPassInput.value.trim();

    // Check Vercel API or local fallback
    let authenticated = false;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) authenticated = true;
      }
    } catch (err) {
      // Local or static fallback to master password #flutter
    }

    if (!authenticated && pass === '#flutter') {
      authenticated = true;
    }

    if (authenticated) {
      sessionStorage.setItem('os_admin_authenticated', 'true');
      authOverlay.style.display = 'none';
      authError.style.display = 'none';
      adminPassInput.value = '';
      loadAllData();
    } else {
      authError.style.display = 'block';
    }
  });

  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('os_admin_authenticated');
    checkAuth();
  });

  // -------------------------------------------------------------
  // 2. TAB NAVIGATION
  // -------------------------------------------------------------
  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      Object.keys(panels).forEach((p) => {
        if (p === target) {
          panels[p].classList.add('active');
        } else {
          panels[p].classList.remove('active');
        }
      });
    });
  });

  // -------------------------------------------------------------
  // 3. DATA LOADING
  // -------------------------------------------------------------
  async function loadAllData() {
    await loadSchools();
    await loadStaff();
    await loadStudents();
    await loadFeed();
    await loadBuses();
  }

  // Load Schools
  async function loadSchools() {
    const grid = document.getElementById('schoolsGrid');
    try {
      currentSchools = await supabase.getSchools();
      populateSchoolSelects();

      if (!currentSchools || currentSchools.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-secondary); padding:40px; text-align:center; grid-column:1/-1;">No schools enrolled yet. Click Add New School above!</div>';
        return;
      }

      grid.innerHTML = currentSchools.map((s) => {
        const logo = s.logo_url || '/assets/logo.png';
        const passcode = s.erp_passcode || 'admin123';
        return `
          <div class="data-card">
            <div class="card-top">
              <img src="${logo}" alt="${s.name}" class="card-icon-img" onerror="this.src='/assets/logo.png'">
              <div>
                <h3 class="card-title">${escapeHtml(s.name)}</h3>
                <div class="card-subtitle">CODE: <strong style="color:var(--accent-gold);">${s.code}</strong></div>
              </div>
            </div>
            <ul class="card-meta-list">
              <li class="card-meta-item">
                <span class="card-meta-label">ERP Passcode:</span>
                <span class="card-meta-value" style="font-family:var(--font-mono); color:var(--accent-gold);">${passcode}</span>
              </li>
              <li class="card-meta-item">
                <span class="card-meta-label">City / Address:</span>
                <span class="card-meta-value">${escapeHtml(s.address || 'Solapur')}</span>
              </li>
              <li class="card-meta-item">
                <span class="card-meta-label">Contact:</span>
                <span class="card-meta-value">${escapeHtml(s.contact || s.email || 'N/A')}</span>
              </li>
            </ul>
            <div class="card-actions">
              <button class="btn btn-secondary btn-sm" onclick="copySchoolCreds('${s.code}', '${passcode}')">
                Copy Credentials
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      grid.innerHTML = `<div style="color:var(--status-danger); padding:40px; text-align:center; grid-column:1/-1;">Failed to load schools: ${err.message}</div>`;
    }
  }

  window.copySchoolCreds = (code, pass) => {
    navigator.clipboard.writeText(`School Code: ${code}\nERP Passcode: ${pass}`);
    alert(`Copied credentials for ${code}!\nCode: ${code}\nPasscode: ${pass}`);
  };

  // Populate school select dropdowns
  function populateSchoolSelects() {
    const selects = [
      document.getElementById('selectSchoolStaff'),
      document.getElementById('selectSchoolStudent'),
      document.getElementById('selectSchoolFeed'),
      document.getElementById('selectSchoolFleet'),
      document.getElementById('staffSchoolId'),
      document.getElementById('studentSchoolId'),
      document.getElementById('feedSchoolId'),
      document.getElementById('busSchoolId')
    ];

    selects.forEach((sel) => {
      if (!sel) return;
      const currentVal = sel.value;
      sel.innerHTML = currentSchools.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (${s.code})</option>`).join('');
      if (currentVal && currentSchools.some(s => s.id === currentVal)) {
        sel.value = currentVal;
      }
    });
  }

  // -------------------------------------------------------------
  // 4. STAFF MANAGEMENT
  // -------------------------------------------------------------
  document.getElementById('selectSchoolStaff').addEventListener('change', (e) => {
    loadStaff(e.target.value);
  });

  async function loadStaff(schoolId) {
    const tbody = document.getElementById('staffTableBody');
    const selectedSchool = schoolId || document.getElementById('selectSchoolStaff').value;
    if (!selectedSchool) return;

    try {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">Loading faculty roster…</td></tr>';
      currentStaff = await supabase.getStaff(selectedSchool);
      
      // Also fetch profiles to get plain passwords
      const profiles = await supabase.request(`/profiles?school_id=eq.${selectedSchool}&role=eq.teacher&select=*`);
      const passMap = {};
      const emailMap = {};
      (profiles || []).forEach(p => {
        passMap[p.id] = p.password || 'teacher123';
        emailMap[p.id] = p.email;
      });

      if (!currentStaff || currentStaff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-secondary);">No teachers registered for this school yet.</td></tr>';
        return;
      }

      tbody.innerHTML = currentStaff.map((st) => {
        const email = emailMap[st.user_id] || 'teacher@school.in';
        const pass = passMap[st.user_id] || 'teacher123';
        const subjects = Array.isArray(st.subjects) ? st.subjects.join(', ') : (st.subjects || 'All');

        return `
          <tr>
            <td><strong>${escapeHtml(st.full_name)}</strong></td>
            <td>${escapeHtml(st.designation || 'Teacher')}</td>
            <td style="font-family:var(--font-mono);">${escapeHtml(email)}</td>
            <td style="font-family:var(--font-mono); color:var(--accent-gold); font-weight:600;">${escapeHtml(pass)}</td>
            <td><span class="header-badge">Class ${st.assigned_class}-${st.assigned_section || 'A'}</span></td>
            <td>${escapeHtml(subjects)}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${email} / ${pass}'); alert('Copied login: ${email}');">Copy</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--status-danger); text-align:center;">Error: ${err.message}</td></tr>`;
    }
  }

  // -------------------------------------------------------------
  // 5. STUDENT ROSTER & PARENT LOGINS
  // -------------------------------------------------------------
  document.getElementById('selectSchoolStudents').addEventListener('change', (e) => {
    loadStudents(e.target.value);
  });

  async function loadStudents(schoolId) {
    const tbody = document.getElementById('studentsTableBody');
    const selectedSchool = schoolId || document.getElementById('selectSchoolStudents').value;
    if (!selectedSchool) return;

    try {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">Loading enrolled students…</td></tr>';
      currentStudents = await supabase.getStudents(selectedSchool);

      if (!currentStudents || currentStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-secondary);">No students enrolled for this school yet.</td></tr>';
        return;
      }

      tbody.innerHTML = currentStudents.map((stu) => {
        return `
          <tr>
            <td style="font-family:var(--font-mono); font-weight:700; color:var(--accent-gold);">${stu.roll_number}</td>
            <td><strong>${escapeHtml(stu.full_name)}</strong></td>
            <td><span class="header-badge">Class ${stu.class_name}-${stu.section}</span></td>
            <td style="font-family:var(--font-mono);">${stu.admission_number || 'N/A'}</td>
            <td>${escapeHtml(stu.guardian_name || 'Parent')}</td>
            <td>${escapeHtml(stu.guardian_phone || 'N/A')}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('Class ${stu.class_name}-${stu.section} Roll: ${stu.roll_number}'); alert('Copied Parent credentials for ${stu.full_name}!');">
                Copy Login
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--status-danger); text-align:center;">Error: ${err.message}</td></tr>`;
    }
  }

  // -------------------------------------------------------------
  // 6. EDUCATIONAL FEED & YOUTUBE VERIFICATION
  // -------------------------------------------------------------
  document.getElementById('selectSchoolFeed').addEventListener('change', (e) => {
    loadFeed(e.target.value);
  });

  async function loadFeed(schoolId) {
    const grid = document.getElementById('feedGrid');
    const selectedSchool = schoolId || document.getElementById('selectSchoolFeed').value;
    if (!selectedSchool) return;

    try {
      grid.innerHTML = '<div style="color:var(--text-secondary); padding:40px; text-align:center; grid-column:1/-1;">Loading video feed…</div>';
      currentFeed = await supabase.getFeed(selectedSchool);

      if (!currentFeed || currentFeed.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-secondary); padding:40px; text-align:center; grid-column:1/-1;">No educational videos published for this school yet. Click "Curate YouTube Video" to add!</div>';
        return;
      }

      grid.innerHTML = currentFeed.map((v) => {
        const thumb = v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_video_id}/hqdefault.jpg`;
        return `
          <div class="data-card">
            <div class="video-preview-box">
              <img src="${thumb}" alt="${escapeHtml(v.title)}" class="video-thumb-img">
              <span class="video-cat-badge">${escapeHtml(v.category || 'General')}</span>
            </div>
            <h3 class="card-title" style="margin-bottom:6px;">${escapeHtml(v.title)}</h3>
            <p style="font-size:0.84rem; color:var(--text-secondary); line-height:1.4; margin-bottom:12px;">
              ${escapeHtml(v.description || 'Educational concept video curated for students.')}
            </p>
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:10px;">
              <span style="font-size:0.75rem; color:var(--accent-gold); font-weight:600;">Class: ${v.class_target || 'All'}</span>
              <div style="display:flex; gap:6px;">
                <a href="${v.youtube_url}" target="_blank" class="btn btn-secondary btn-sm">Watch ↗</a>
                <button class="btn btn-danger btn-sm" onclick="deleteFeedItem('${v.id}')">Delete</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      grid.innerHTML = `<div style="color:var(--status-danger); padding:40px; text-align:center; grid-column:1/-1;">Error loading feed: ${err.message}</div>`;
    }
  }

  window.deleteFeedItem = async (id) => {
    if (!confirm('Are you sure you want to remove this video from the school feed?')) return;
    try {
      await supabase.deleteFeedVideo(id);
      loadFeed();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  // YouTube link parser & thumbnail auto-validator
  function parseYoutubeUrl(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  const ytUrlInput = document.getElementById('feedYoutubeUrl');
  const ytStatus = document.getElementById('youtubeVerifyStatus');
  const previewContainer = document.getElementById('thumbnailPreviewContainer');
  const previewImg = document.getElementById('verifiedThumbImg');

  ytUrlInput.addEventListener('input', () => {
    const videoId = parseYoutubeUrl(ytUrlInput.value.trim());
    if (videoId) {
      const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      previewImg.src = thumbUrl;
      previewContainer.style.display = 'block';
      ytStatus.innerHTML = `✅ <span style="color:var(--status-success);">Valid YouTube Video ID: <strong>${videoId}</strong></span>`;
      verifiedYoutubeData = {
        video_id: videoId,
        thumb_url: thumbUrl
      };
    } else {
      previewContainer.style.display = 'none';
      verifiedYoutubeData = null;
      if (ytUrlInput.value.trim().length > 0) {
        ytStatus.innerHTML = `⚠️ <span style="color:var(--status-warning);">Please enter a valid YouTube video link</span>`;
      } else {
        ytStatus.textContent = 'Paste link to auto-verify thumbnail and playable status';
      }
    }
  });

  // -------------------------------------------------------------
  // 7. MODALS LOGIC & SUBMISSIONS
  // -------------------------------------------------------------
  const modalAddSchool = document.getElementById('modalAddSchool');
  const modalAddStaff = document.getElementById('modalAddStaff');
  const modalAddStudent = document.getElementById('modalAddStudent');
  const modalAddVideo = document.getElementById('modalAddVideo');

  document.getElementById('btnOpenAddSchool').addEventListener('click', () => modalAddSchool.classList.add('active'));
  document.getElementById('btnOpenAddStaff').addEventListener('click', () => modalAddStaff.classList.add('active'));
  document.getElementById('btnOpenAddStudent').addEventListener('click', () => modalAddStudent.classList.add('active'));
  document.getElementById('btnOpenAddVideo').addEventListener('click', () => modalAddVideo.classList.add('active'));

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.close;
      document.getElementById(modalId).classList.remove('active');
    });
  });

  // Save School
  document.getElementById('formAddSchool').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveSchool');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      let logoUrl = document.getElementById('schoolLogoUrl').value.trim();
      const logoFile = document.getElementById('schoolLogoFile').files[0];

      if (logoFile) {
        btn.textContent = 'Uploading Logo…';
        logoUrl = await supabase.uploadLogo(logoFile, logoFile.name);
      }

      await supabase.createSchool({
        name: document.getElementById('schoolName').value.trim(),
        code: document.getElementById('schoolCode').value.trim().toUpperCase(),
        erp_passcode: document.getElementById('schoolPasscode').value.trim(),
        logo_url: logoUrl || null,
        address: document.getElementById('schoolAddress').value.trim() || null,
        contact: document.getElementById('schoolContact').value.trim() || null,
        email: document.getElementById('schoolEmail').value.trim() || null
      });

      alert('School successfully created!');
      modalAddSchool.classList.remove('active');
      document.getElementById('formAddSchool').reset();
      await loadSchools();
    } catch (err) {
      alert('Error creating school: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save School';
    }
  });

  // Save Staff
  document.getElementById('formAddStaff').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveStaff');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const schoolId = document.getElementById('staffSchoolId').value;
      const fullName = document.getElementById('staffFullName').value.trim();
      const email = document.getElementById('staffEmail').value.trim();
      const password = document.getElementById('staffPassword').value.trim();
      const designation = document.getElementById('staffDesignation').value.trim();
      const phone = document.getElementById('staffPhone').value.trim();
      const assignedClass = document.getElementById('staffClass').value.trim();
      const assignedSection = document.getElementById('staffSection').value.trim().toUpperCase();
      const subjectsRaw = document.getElementById('staffSubjects').value.trim();
      const subjects = subjectsRaw ? subjectsRaw.split(',').map(s => s.trim()) : [];

      await supabase.createStaff(
        {
          school_id: schoolId,
          full_name: fullName,
          designation,
          assigned_class: assignedClass,
          assigned_section: assignedSection,
          subjects,
          phone
        },
        { email, password }
      );

      alert(`Teacher account created!\nEmail: ${email}\nPassword: ${password}`);
      modalAddStaff.classList.remove('active');
      document.getElementById('formAddStaff').reset();
      await loadStaff(schoolId);
    } catch (err) {
      alert('Error creating teacher: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Teacher Account';
    }
  });

  // Save Student
  document.getElementById('formAddStudent').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveStudent');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const schoolId = document.getElementById('studentSchoolId').value;
      const fullName = document.getElementById('studentFullName').value.trim();
      const className = document.getElementById('studentClass').value.trim();
      const section = document.getElementById('studentSection').value.trim().toUpperCase();
      const rollNumber = document.getElementById('studentRoll').value.trim();
      const admissionNo = document.getElementById('studentAdmissionNo').value.trim();
      const bloodGroup = document.getElementById('studentBloodGroup').value;
      const guardianName = document.getElementById('studentGuardianName').value.trim();
      const guardianPhone = document.getElementById('studentGuardianPhone').value.trim();

      await supabase.createStudent({
        school_id: schoolId,
        full_name: fullName,
        class_name: className,
        section,
        roll_number: rollNumber,
        admission_number: admissionNo || null,
        blood_group: bloodGroup,
        guardian_name: guardianName || null,
        guardian_phone: guardianPhone || null
      });

      alert(`Student enrolled!\nParent Login: Class ${className}-${section}, Roll: ${rollNumber}`);
      modalAddStudent.classList.remove('active');
      document.getElementById('formAddStudent').reset();
      await loadStudents(schoolId);
    } catch (err) {
      alert('Error saving student: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Student';
    }
  });

  // Save Educational Video
  document.getElementById('formAddVideo').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!verifiedYoutubeData) {
      alert('Please enter a valid YouTube link first.');
      return;
    }

    const btn = document.getElementById('btnSaveVideo');
    btn.disabled = true;
    btn.textContent = 'Publishing…';

    try {
      const schoolId = document.getElementById('feedSchoolId').value;
      const title = document.getElementById('feedTitle').value.trim();
      const desc = document.getElementById('feedDesc').value.trim();
      const category = document.getElementById('feedCategory').value;
      const classTarget = document.getElementById('feedClassTarget').value;
      const url = document.getElementById('feedYoutubeUrl').value.trim();

      await supabase.createFeedVideo({
        school_id: schoolId,
        title,
        description: desc,
        youtube_url: url,
        youtube_video_id: verifiedYoutubeData.video_id,
        thumbnail_url: verifiedYoutubeData.thumb_url,
        category,
        class_target: classTarget
      });

      alert('Video published to school feed successfully!');
      modalAddVideo.classList.remove('active');
      document.getElementById('formAddVideo').reset();
      previewContainer.style.display = 'none';
      verifiedYoutubeData = null;
      await loadFeed(schoolId);
    } catch (err) {
      alert('Error publishing video: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Publish to School Feed';
    }
  });

  // -------------------------------------------------------------
  // 7.5 FLEET & BUS MANAGEMENT
  // -------------------------------------------------------------
  const selectSchoolFleet = document.getElementById('selectSchoolFleet');
  if (selectSchoolFleet) {
    selectSchoolFleet.addEventListener('change', (e) => {
      loadBuses(e.target.value);
    });
  }

  async function loadBuses(schoolId) {
    const table = document.getElementById('tableBuses');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const sel = document.getElementById('selectSchoolFleet');
    const selectedSchool = schoolId || (sel ? sel.value : null);

    if (!selectedSchool) {
      if (currentSchools.length > 0 && sel) {
        sel.value = currentSchools[0].id;
        return loadBuses(currentSchools[0].id);
      }
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">Select school to load fleet.</td></tr>';
      return;
    }

    try {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">Loading fleet…</td></tr>';
      currentBuses = await supabase.getBuses(selectedSchool);

      // Update transit hours display
      const hoursDisplay = document.getElementById('transitHoursDisplay');
      if (hoursDisplay && currentBuses && currentBuses.length > 0) {
        hoursDisplay.textContent = `${currentBuses[0].school_start_time || '07:30 AM'} – ${currentBuses[0].school_end_time || '02:00 PM'}`;
      }

      if (!currentBuses || currentBuses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">No buses or drivers registered for this school yet. Click "Add New Bus & Driver" above!</td></tr>';
        return;
      }

      tbody.innerHTML = currentBuses.map((b) => `
        <tr>
          <td><strong style="color:var(--accent-gold); font-family:var(--font-mono);">${escapeHtml(b.bus_number)}</strong></td>
          <td><span style="font-size:0.85rem; color:var(--text-secondary);">${escapeHtml(b.route_name)}</span></td>
          <td><strong>${escapeHtml(b.driver_name)}</strong></td>
          <td><span style="font-family:var(--font-mono);">${escapeHtml(b.driver_phone)}</span></td>
          <td><code style="background:var(--bg-input); padding:2px 8px; border-radius:4px; color:var(--accent-gold);">${escapeHtml(b.driver_password)}</code></td>
          <td><span style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(b.school_start_time || '07:30 AM')} – ${escapeHtml(b.school_end_time || '02:00 PM')}</span></td>
          <td style="text-align:right;">
            <button class="btn btn-secondary btn-sm" style="color:var(--status-danger);" onclick="deleteBus('${b.id}')">Delete</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--status-danger); padding:30px;">Error loading fleet: ${err.message}</td></tr>`;
    }
  }

  // Open modal
  const btnOpenAddBus = document.getElementById('btnOpenAddBus');
  const modalAddBus = document.getElementById('modalAddBus');
  if (btnOpenAddBus && modalAddBus) {
    btnOpenAddBus.addEventListener('click', () => {
      populateSchoolSelects();
      const selFleet = document.getElementById('selectSchoolFleet');
      if (selFleet && selFleet.value) {
        document.getElementById('busSchoolId').value = selFleet.value;
      }
      modalAddBus.classList.add('active');
    });
  }

  // Add Bus Form
  const formAddBus = document.getElementById('formAddBus');
  if (formAddBus) {
    formAddBus.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSaveBus');
      btn.disabled = true;
      btn.textContent = 'Registering…';

      try {
        const schoolId = document.getElementById('busSchoolId').value;
        const busNumber = document.getElementById('busNumber').value.trim();
        const driverName = document.getElementById('busDriverName').value.trim();
        const driverPhone = document.getElementById('busDriverPhone').value.trim();
        const driverPassword = document.getElementById('busDriverPassword').value.trim();
        const routeName = document.getElementById('busRouteName').value.trim();
        const startTime = document.getElementById('busStartTime').value.trim();
        const endTime = document.getElementById('busEndTime').value.trim();

        await supabase.createBus({
          school_id: schoolId,
          bus_number: busNumber,
          driver_name: driverName,
          driver_phone: driverPhone,
          driver_password: driverPassword,
          route_name: routeName,
          school_start_time: startTime,
          school_end_time: endTime
        });

        alert(`Bus & Driver registered successfully!\nDriver Phone: ${driverPhone}\nDriver Passcode: ${driverPassword}`);
        modalAddBus.classList.remove('active');
        formAddBus.reset();
        await loadBuses(schoolId);
      } catch (err) {
        alert('Failed to register bus: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Register Bus Fleet';
      }
    });
  }

  // Delete Bus
  window.deleteBus = async (id) => {
    if (!confirm('Are you sure you want to remove this bus and driver?')) return;
    try {
      await supabase.deleteBus(id);
      const sel = document.getElementById('selectSchoolFleet');
      await loadBuses(sel ? sel.value : null);
    } catch (err) {
      alert('Failed to delete bus: ' + err.message);
    }
  };

  // Update Transit Hours
  const btnUpdateTransitHours = document.getElementById('btnUpdateTransitHours');
  if (btnUpdateTransitHours) {
    btnUpdateTransitHours.addEventListener('click', async () => {
      const sel = document.getElementById('selectSchoolFleet');
      const schoolId = sel ? sel.value : null;
      if (!schoolId) return alert('Please select a school first.');

      const newStart = prompt('Enter Morning Pickup Transit Start Time:', '07:30 AM');
      if (!newStart) return;
      const newEnd = prompt('Enter Afternoon Drop Transit End Time:', '02:00 PM');
      if (!newEnd) return;

      try {
        // Update all buses for this school with new timing
        if (currentBuses && currentBuses.length > 0) {
          for (const b of currentBuses) {
            await supabase.updateBus(b.id, {
              school_start_time: newStart,
              school_end_time: newEnd
            });
          }
        }
        const hoursDisplay = document.getElementById('transitHoursDisplay');
        if (hoursDisplay) hoursDisplay.textContent = `${newStart} – ${newEnd}`;
        alert(`School Transit Operating Hours updated to: ${newStart} – ${newEnd}`);
        await loadBuses(schoolId);
      } catch (err) {
        alert('Failed to update timings: ' + err.message);
      }
    });
  }

  // -------------------------------------------------------------
  // 8. PWA INSTALL PROMPT
  // -------------------------------------------------------------
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstallPwa.style.display = 'inline-flex';
  });

  btnInstallPwa.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      btnInstallPwa.style.display = 'none';
    }
    deferredPrompt = null;
  });

  // Utility escape
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Check
  checkAuth();
});
