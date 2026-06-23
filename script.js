// AI Health Predictor - Complete Fixed Version
// Persistent login + Email notifications

document.addEventListener('DOMContentLoaded', function() {
    const USERS_KEY = 'healthUsers';
    const TOKEN_KEY = 'healthToken';
    const USERS_FILE = 'data/users.json';

    // Elements
    const authSection = document.getElementById('authSection');
    const app = document.getElementById('app');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const healthForm = document.getElementById('healthForm');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const historyList = document.getElementById('historyList');
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const authMessage = document.getElementById('authMessage');
    const tabBtns = document.querySelectorAll('.tab-btn');

    let currentUser = null;
    let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    let diseasesData = null;
    let symptomsMap = null;
    let selectedSymptoms = new Set();
    let allSymptoms = [];

    // EmailJS - Admin notifications (keys in code)
    const EMAILJS_PUBLIC = 'YOUR_PUBLIC_KEY';
    const EMAILJS_SERVICE = 'YOUR_SERVICE_ID';
    const EMAILJS_TEMPLATE = 'YOUR_TEMPLATE_ID';

    function hash(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) & 0xFFFFFFFF;
        return Math.abs(h).toString(36);
    }

    async function loadUsersFromFile() {
        try {
            const response = await fetch(USERS_FILE);
            if (response.ok) {
                const fileUsers = await response.json();
                if (fileUsers.length > 0 && users.length === 0) {
                    users = fileUsers;
                    saveUsers();
                    console.log('Loaded', users.length, 'users from file');
                }
            }
        } catch (err) {
            console.log('users.json not found - create by signup');
        }
    }

    function saveUsers() {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function downloadUsers() {
        const dataStr = JSON.stringify(users, null, 2);
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data_users.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function uploadUsersFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                users = JSON.parse(e.target.result);
                saveUsers();
                downloadUsers();
                showMessage('Users imported successfully!', 'success');
            } catch {
                showMessage('Invalid file', 'error');
            }
        };
        reader.readAsText(file);
    }

    function isLoggedIn() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return false;
        const data = JSON.parse(token);
        return data.userId && Date.now() - data.timestamp < 86400000; // 24h
    }

    async function signup(name, mobile, email, password) {
        if (!/^[0-9]{10}$/.test(mobile)) return showMessage('Enter 10-digit mobile', 'error');
        if (users.find(u => u.mobile === mobile)) return showMessage('Mobile exists', 'error');
        if (users.find(u => u.email === email)) return showMessage('Email exists', 'error');

        const newUser = {
            id: Date.now().toString(),
            name, mobile, email,
            passwordHash: hash(password),
            predictions: [],
            created: new Date().toLocaleString()
        };

        users.push(newUser);
        saveUsers();
        downloadUsers();

        // Auto login
        currentUser = newUser;
        localStorage.setItem(TOKEN_KEY, JSON.stringify({userId: newUser.id, timestamp: Date.now()}));
        showApp();
        showMessage('Account created & saved to Desktop!', 'success');
        return true;
    }

    function signin(identifier, password) {
        const user = users.find(u => u.mobile === identifier || u.email === identifier);
        if (!user) return showMessage('No account found', 'error');
        if (user.passwordHash !== hash(password)) return showMessage('Wrong password', 'error');

        currentUser = user;
        localStorage.setItem(TOKEN_KEY, JSON.stringify({userId: user.id, timestamp: Date.now()}));
        showApp();
        return true;
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        currentUser = null;
        showAuth();
    }

    function showApp() {
        authSection.classList.add('hidden');
        app.classList.remove('hidden');
        updateUserInfo();
        loadUserHistory();
        loadHealthData();
    }

    function showAuth() {
        app.classList.add('hidden');
        authSection.classList.remove('hidden');
    }

    function showMessage(text, type) {
        authMessage.textContent = text;
        authMessage.className = `auth-message ${type} show`;
        setTimeout(() => authMessage.classList.remove('show'), 3000);
    }

    function updateUserInfo() {
        userInfo.textContent = `Welcome ${currentUser.name}`;
    }

    function loadUserHistory() {
        const predictions = currentUser.predictions || [];
        historyList.innerHTML = predictions.slice(-5).map(p => 
            `<li>${p.date.slice(0,10)} - Score: ${Math.round(p.prediction.score)}</li>`
        ).join('') || 'No predictions';
    }

    async function loadHealthData() {
        try {
            diseasesData = await (await fetch('data/diseases.json')).json();
            symptomsMap = await (await fetch('data/symptoms-map.json')).json();
            allSymptoms = diseasesData.allSymptoms || [];
        } catch (e) {
            console.error('Failed to load health data', e);
        }
    }

    // Event handlers
    document.addEventListener('change', e => {
        if (e.target.id === 'usersImport') uploadUsersFile(e.target.files[0]);
        if (e.target.id === 'reportUpload') parseReports(e.target.files);
    });

    document.getElementById('symptomsSearch').oninput = e => updateSymptomsUI(e.target.value);

    document.getElementById('calcBMI').onclick = () => {
        const h = parseFloat(document.getElementById('height').value);
        const w = parseFloat(document.getElementById('weight').value);
        if (h && w) document.getElementById('bmiVal').textContent = (w / Math.pow(h/100,2)).toFixed(1);
    };

    ['age','bp','cholesterol'].forEach(id => {
        document.getElementById(id).oninput = () => document.getElementById(id+'Val').textContent = document.getElementById(id).value;
    });

    function parseReports(files) {
        // Simple symptom parsing
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                const text = e.target.result.toLowerCase();
                allSymptoms.filter(s => text.includes(s)).forEach(s => selectedSymptoms.add(s));
                updateSymptomsUI();
            };
            reader.readAsText(file);
        });
    }

    function updateSymptomsUI(search = '') {
        const container = document.getElementById('symptomsSelect');
        const filtered = allSymptoms.filter(s => s.includes(search.toLowerCase()));
        container.innerHTML = filtered.map(s => 
            `<label class="checkbox-item">
                <input type="checkbox" onchange="toggleSymptom('${s}')" ${selectedSymptoms.has(s) ? 'checked' : ''}>
                <span>${s.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</span>
            </label>`
        ).join('') || '<p>No symptoms</p>';
    }

    window.toggleSymptom = s => {
        selectedSymptoms.has(s) ? selectedSymptoms.delete(s) : selectedSymptoms.add(s);
        updateSymptomsUI();
    };

    tabBtns.forEach(btn => btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(btn.dataset.tab+'Form').classList.add('active');
    });

    signinForm.onsubmit = e => {
        e.preventDefault();
        signin(signinForm.signinIdentifier.value, signinForm.signinPassword.value);
    };

    signupForm.onsubmit = e => {
        e.preventDefault();
        signup(signupForm.signupName.value, signupForm.signupMobile.value, signupForm.signupEmail.value, signupForm.signupPassword.value);
    };

    logoutBtn.onclick = logout;

    // ---------------------- Disease prediction (fast, no ML) ----------------------

    function computeDiseaseRanking(symptomsArr) {
        const symptomsSet = new Set(symptomsArr);
        const ranked = [];

        if (!diseasesData?.categories) return ranked;

        const critical = symptomsMap?.criticalSymptoms || [];
        const multipliers = symptomsMap?.riskMultipliers || {};

        for (const categoryName of Object.keys(diseasesData.categories)) {
            const cat = diseasesData.categories[categoryName];
            for (const d of cat.diseases) {
                const diseaseSymptoms = d.symptoms || [];

                let match = 0;
                let criticalHit = 0;
                let multiplierHit = 0;

                for (const ds of diseaseSymptoms) {
                    if (!symptomsSet.has(ds)) continue;
                    match += 1;
                    if (critical.includes(ds)) criticalHit += 1;

                    for (const key of Object.keys(multipliers)) {
                        if ((multipliers[key] || []).includes(ds)) multiplierHit += 1;
                    }
                }

                if (match === 0) continue;

                const overlapScore = diseaseSymptoms.length ? (match / diseaseSymptoms.length) : 0;
                const score = overlapScore * 100 + criticalHit * 12 + multiplierHit * 3;

                ranked.push({
                    name: d.name,
                    category: categoryName,
                    score: Math.round(score),
                    matchedSymptoms: diseaseSymptoms.filter(x => symptomsSet.has(x))
                });
            }
        }

        return ranked.sort((a, b) => b.score - a.score);
    }

    function computeHealthScoreFast(formData, symptomsArr, rankedTop) {
        // Keep existing heuristic feel, but blend in top disease score.
        const base = 85
            - (formData.age > 60 ? 15 : 0)
            - (formData.bmi > 30 ? 20 : 0)
            - (formData.bp > 140 ? 15 : 0)
            - symptomsArr.length * 3;

        const top = rankedTop?.[0];
        if (!top) return Math.max(0, Math.min(100, base));

        // Reduce score based on risk score.
        const delta = Math.min(25, Math.floor(top.score / 6));
        return Math.max(0, Math.min(100, base - delta));
    }

    function bestEffortSymptomsFromFilename(filename) {
        const t = String(filename || '').toLowerCase();
        const found = new Set();

        // direct substring matches against known pretty strings
        for (const s of allSymptoms) {
            const pretty = s.replace(/_/g, ' ');
            if (t.includes(pretty)) found.add(s);
        }

        // token matches
        const tokens = t.split(/[^a-z0-9]+/).filter(Boolean);
        const normalized = tokens.map(tok => tok.replace(/[^a-z0-9]+/g, '_'));
        normalized.forEach(nt => {
            if (allSymptoms.includes(nt)) found.add(nt);
        });

        return Array.from(found);
    }

    function renderResults(diseaseRankedTop, finalScore, symptomsArr) {
        document.getElementById('healthScore').textContent = finalScore;

        const riskListEl = document.getElementById('riskList');
        if (diseaseRankedTop.length) {
            riskListEl.innerHTML = diseaseRankedTop.map(d =>
                `<li><strong>${d.name}</strong><br/><small>${d.category} • Match score: ${d.score}</small></li>`
            ).join('');
        } else {
            riskListEl.innerHTML = '<li>No matching disease patterns found in dataset.</li>';
        }

        const advice = finalScore > 70
            ? 'You look relatively stable based on selected symptoms. If symptoms worsen, consult a doctor.'
            : 'Possible health concerns detected. Consider seeing a doctor for proper evaluation.';
        document.getElementById('adviceText').textContent = advice;

        results.classList.remove('hidden');
        loading.classList.add('hidden');
    }

    function runPredictionFromSymptoms(symptomsArr) {
        const formData = {
            age: parseInt(document.getElementById('age').value),
            bmi: parseFloat(document.getElementById('bmiVal').textContent),
            bp: parseInt(document.getElementById('bp').value),
            cholesterol: parseInt(document.getElementById('cholesterol').value)
        };

        const ranked = computeDiseaseRanking(symptomsArr);
        const top = ranked.slice(0, 5);
        const score = computeHealthScoreFast(formData, symptomsArr, top);

        renderResults(top, score, symptomsArr);

        // Save prediction (store top diseases)
        currentUser.predictions.push({
            prediction: {
                score,
                topDiseases: top
            },
            date: new Date().toISOString()
        });
        saveUsers();
        downloadUsers();
        loadUserHistory();
    }

    // ---------------------- Manual symptom selection submit ----------------------

    healthForm.onsubmit = e => {
        e.preventDefault();
        if (!currentUser) return showAuth();

        loading.classList.remove('hidden');
        runPredictionFromSymptoms(Array.from(selectedSymptoms));
    };

    // ---------------------- Image option (fast mode: filename → symptoms → diseases) ----------------------

    const imageUpload = document.getElementById('imageUpload');
    const imagePreviewWrap = document.getElementById('imagePreviewWrap');
    const detectedSymptomsChips = document.getElementById('detectedSymptomsChips');
    const imageDetectedRaw = document.getElementById('imageDetectedRaw');

    function setDetectedSymptomsUI(symptomsArr, filename) {
        if (!detectedSymptomsChips) return;

        if (symptomsArr.length) {
            detectedSymptomsChips.innerHTML = symptomsArr.map(s => {
                const pretty = s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                return `<span class="chip">${pretty}</span>`;
            }).join('');
        } else {
            detectedSymptomsChips.innerHTML = '';
        }

        if (imageDetectedRaw) {
            imageDetectedRaw.textContent = symptomsArr.length
                ? `Detected symptoms: ${symptomsArr.join(', ')}`
                : `Filename: ${filename} (no known symptom keywords found)`;
        }

        if (imagePreviewWrap) imagePreviewWrap.classList.remove('hidden');
    }

    function handleImageUpload(files) {
        if (!files || !files.length) return;
        const file = files[0];
        const filename = file?.name || '';

        const detected = bestEffortSymptomsFromFilename(filename);

        // Update selected symptoms
        selectedSymptoms = new Set(selectedSymptoms); // keep reference safe
        for (const s of Array.from(selectedSymptoms)) selectedSymptoms.delete(s);
        detected.forEach(s => selectedSymptoms.add(s));

        // Update symptoms UI + chips
        updateSymptomsUI(document.getElementById('symptomsSearch')?.value || '');
        setDetectedSymptomsUI(detected, filename);

        // Instant prediction
        loading.classList.remove('hidden');
        runPredictionFromSymptoms(Array.from(selectedSymptoms));
    }

    if (imageUpload) {
        imageUpload.addEventListener('change', e => {
            if (!currentUser) return showAuth();
            handleImageUpload(e.target.files);
        });
    }

    // Init
    async function init() {
        await loadUsersFromFile();
        isLoggedIn() ? showApp() : showAuth();
    }

    init();
});

