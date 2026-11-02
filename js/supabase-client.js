// Supabase Client for OpenSoftwares Admin PWA
const SUPABASE_CONFIG = {
  url: 'https://jjraluhoybumzpdikark.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcmFsdWhveWJ1bXpwZGlrYXJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjM5MzE4MywiZXhwIjoyMDk3OTY5MTgzfQ.P1zlxYXXlDQhU0a5dP3km1CZmrd7yJNkPVmPe6YLr9Y'
};

const supabase = {
  async request(endpoint, options = {}) {
    const headers = {
      'apikey': SUPABASE_CONFIG.key,
      'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    };

    const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1${endpoint}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase error (${res.status}): ${err}`);
    }

    if (res.status === 204) return null;
    return await res.json();
  },

  // Schools
  async getSchools() {
    return this.request('/schools?select=*&order=created_at.asc');
  },

  async createSchool(school) {
    return this.request('/schools', {
      method: 'POST',
      body: JSON.stringify(school)
    });
  },

  async updateSchool(id, updates) {
    return this.request(`/schools?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  async deleteSchool(id) {
    return this.request(`/schools?id=eq.${id}`, {
      method: 'DELETE'
    });
  },

  // Staff Profiles
  async getStaff(schoolId) {
    let query = '/staff_profiles?select=*&order=created_at.desc';
    if (schoolId) query += `&school_id=eq.${schoolId}`;
    return this.request(query);
  },

  async createStaff(staffData, loginData) {
    // 1. Create in profiles for auth
    const profile = await this.request('/profiles', {
      method: 'POST',
      body: JSON.stringify({
        school_id: staffData.school_id,
        email: loginData.email,
        full_name: staffData.full_name,
        role: 'teacher',
        password: loginData.password,
        designation: staffData.designation,
        phone: staffData.phone
      })
    });

    const userProfile = Array.isArray(profile) ? profile[0] : profile;

    // 2. Create in staff_profiles for directory
    return this.request('/staff_profiles', {
      method: 'POST',
      body: JSON.stringify({
        ...staffData,
        user_id: userProfile ? userProfile.id : null
      })
    });
  },

  // Students
  async getStudents(schoolId) {
    let query = '/students?select=*&order=class_name.asc,roll_number.asc';
    if (schoolId) query += `&school_id=eq.${schoolId}`;
    return this.request(query);
  },

  async createStudent(student) {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(student)
    });
  },

  async deleteStudent(id) {
    return this.request(`/students?id=eq.${id}`, {
      method: 'DELETE'
    });
  },

  // Educational Feed (YouTube Videos)
  async getFeed(schoolId) {
    let query = '/school_feed?select=*&order=created_at.desc';
    if (schoolId) query += `&school_id=eq.${schoolId}`;
    return this.request(query);
  },

  async createFeedVideo(videoData) {
    return this.request('/school_feed', {
      method: 'POST',
      body: JSON.stringify(videoData)
    });
  },

  async deleteFeedVideo(id) {
    return this.request(`/school_feed?id=eq.${id}`, {
      method: 'DELETE'
    });
  },

  // Storage Upload for School Logos
  async uploadLogo(file, fileName) {
    const cleanName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const path = `logos/${cleanName}`;
    const uploadUrl = `${SUPABASE_CONFIG.url}/storage/v1/object/school-logos/${path}`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.key,
        'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
        'Content-Type': file.type || 'image/jpeg'
      },
      body: file
    });

    if (!res.ok) {
      throw new Error(`Logo upload failed: ${await res.text()}`);
    }

    return `${SUPABASE_CONFIG.url}/storage/v1/object/public/school-logos/${path}`;
  },

  // Buses & Fleet
  async getBuses(schoolId) {
    let query = '/buses?select=*&order=created_at.desc';
    if (schoolId) query += `&school_id=eq.${schoolId}`;
    return this.request(query);
  },

  async createBus(busData) {
    return this.request('/buses', {
      method: 'POST',
      body: JSON.stringify(busData)
    });
  },

  async updateBus(id, updates) {
    return this.request(`/buses?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  async deleteBus(id) {
    return this.request(`/buses?id=eq.${id}`, {
      method: 'DELETE'
    });
  }
};
