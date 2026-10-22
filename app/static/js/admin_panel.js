// Sidebar tab switching
const sidebarBtns = document.querySelectorAll('.sidebar-btn');
const tabs = document.querySelectorAll('.admin-tab');
sidebarBtns.forEach(btn => {
    btn.onclick = () => {
        const tabId = 'tab-' + btn.dataset.tab;
        const panel = document.getElementById(tabId);
        if (!panel) return;
        tabs.forEach(tab => tab.classList.add('hidden'));
        panel.classList.remove('hidden');
        sidebarBtns.forEach(b => {
            b.classList.remove('bg-blue-600', 'is-active');
        });
        btn.classList.add('is-active');
    };
});
if (sidebarBtns[0]) sidebarBtns[0].click();

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function truncate(text, max) {
    const s = String(text || '');
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
}

function humanizeKey(key) {
    return String(key || '')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function formatSettingValue(value) {
    if (value == null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) {
        if (!value.length) return '—';
        return value.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
    }
    if (typeof value === 'object') {
        return Object.entries(value)
            .map(([k, v]) => `${humanizeKey(k)} ${formatSettingValue(v)}`)
            .join(' · ');
    }
    // Stored JSON sometimes arrives as a stringified array/object
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
                return formatSettingValue(JSON.parse(trimmed));
            } catch {
                /* keep original string */
            }
        }
    }
    return String(value);
}

/** Turn settings JSON into readable label/value rows for the table. */
function formatSettingsHtml(settings) {
    const entries = Object.entries(settings || {});
    if (!entries.length) {
        return '<span class="bnb-settings-empty">No settings</span>';
    }
    return `<ul class="bnb-settings-list">${entries.map(([key, value]) =>
        `<li><span class="bnb-settings-key">${escapeHtml(humanizeKey(key))}</span>` +
        `<span class="bnb-settings-val">${escapeHtml(formatSettingValue(value))}</span></li>`
    ).join('')}</ul>`;
}

let usersCache = [];
let tenantsCache = [];

async function fetchUsers() {
    const res = await fetch('/api/v1/auth/user/all');
    if (!res.ok) throw new Error('Failed to load users');
    usersCache = await res.json();
    return usersCache;
}

async function fetchTenants() {
    const res = await fetch('/api/v1/tenant/');
    if (!res.ok) throw new Error('Failed to load businesses');
    tenantsCache = await res.json();
    return tenantsCache;
}

function businessName(id) {
    const t = tenantsCache.find(x => x.id === id);
    return t ? t.name : (id ? 'Unknown business' : '—');
}

function userLabel(user) {
    if (!user) return '—';
    return user.full_name ? `${user.full_name} (${user.email})` : user.email;
}

function findUser(id) {
    return usersCache.find(u => u.id === id) || null;
}

async function readError(res) {
    try {
        const data = await res.json();
        if (typeof data.detail === 'string') return data.detail;
        if (Array.isArray(data.detail)) {
            return data.detail.map(d => d.msg || JSON.stringify(d)).join('; ');
        }
        return data.msg || JSON.stringify(data);
    } catch {
        return res.statusText || 'Request failed';
    }
}

// Modal helper
function createModal(content) {
    const modal = document.createElement('div');
    modal.className = 'bnb-modal-overlay';
    modal.innerHTML = `<div class="bnb-modal" role="dialog" aria-modal="true">${content}</div>`;

    function onKeydown(e) {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        modal.remove();
    }

    const removeNative = modal.remove.bind(modal);
    modal.remove = function () {
        document.removeEventListener('keydown', onKeydown);
        removeNative();
    };

    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.addEventListener('keydown', onKeydown);
    document.body.appendChild(modal);
    if (typeof window.initPasswordToggles === 'function') {
        window.initPasswordToggles(modal);
    }
    return modal;
}

/** Styled confirm dialog — replaces window.confirm for destructive actions. */
function confirmModal({
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel'
} = {}) {
    return new Promise((resolve) => {
        let settled = false;
        const modal = createModal(`
            <h3 class="bnb-modal__title gradient-text">${escapeHtml(title)}</h3>
            <p class="bnb-confirm__message">${escapeHtml(message)}</p>
            <div class="bnb-modal__actions">
                <button type="button" class="bnb-btn bnb-btn--primary confirm-yes">${escapeHtml(confirmLabel)}</button>
                <button type="button" class="bnb-btn bnb-btn--ghost confirm-no">${escapeHtml(cancelLabel)}</button>
            </div>
        `);
        const finish = (value) => {
            if (settled) return;
            settled = true;
            modal.remove();
            resolve(value);
        };
        const removeNative = modal.remove.bind(modal);
        modal.remove = function () {
            if (!settled) {
                settled = true;
                resolve(false);
            }
            removeNative();
        };
        modal.querySelector('.confirm-yes').onclick = () => finish(true);
        modal.querySelector('.confirm-no').onclick = () => finish(false);
    });
}

function filterTable(inputId, tableId) {
    const input = document.getElementById(inputId);
    const table = document.getElementById(tableId);
    if (!input || !table) return;
    input.addEventListener('input', function () {
        const val = this.value.toLowerCase();
        Array.from(table.children).forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(val) ? '' : 'none';
        });
    });
}

// --- USERS CRUD ---
async function loadUsers() {
    const table = document.getElementById('users-table');
    try {
        await Promise.all([fetchUsers(), tenantsCache.length ? Promise.resolve(tenantsCache) : fetchTenants()]);
    } catch (err) {
        table.innerHTML = `<tr><td colspan="5">${escapeHtml(err.message)}</td></tr>`;
        return;
    }
    table.innerHTML = '';
    usersCache.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(u.full_name || '—')}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(businessName(u.business_profile_id))}</td>
            <td>${u.is_admin ? '<span class="bnb-admin-badge">Admin</span>' : 'Member'}</td>
            <td class="flex gap-2">
                <button type="button" class="edit-user-btn bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs" data-id="${escapeHtml(u.id)}">Edit</button>
                <button type="button" class="delete-user-btn bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded text-xs" data-id="${escapeHtml(u.id)}">Delete</button>
            </td>
        `;
        table.appendChild(tr);
    });
    bindUserActions();
}

function bindUserActions() {
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.onclick = function () {
            const id = btn.dataset.id;
            const user = findUser(id);
            if (!user) return alert('User not found.');
            const modal = createModal(`
                <h3 class="bnb-modal__title gradient-text">Edit User</h3>
                <form id="edit-user-form" class="bnb-modal__form">
                    <input type="text" name="full_name" class="bnb-modal__field" value="${escapeHtml(user.full_name || '')}" placeholder="Full Name" required />
                    <input type="email" name="email" class="bnb-modal__field" value="${escapeHtml(user.email || '')}" placeholder="Email" required />
                    <input type="password" name="password" class="bnb-modal__field" placeholder="New password (leave blank to keep)" />
                    <p class="text-xs" style="color:var(--bnb-muted);margin:0">Password needs 8+ chars, upper, lower, number, and symbol.</p>
                    <div class="bnb-modal__actions">
                        <button type="submit" class="bnb-btn bnb-btn--primary">Save</button>
                        <button type="button" class="bnb-btn bnb-btn--ghost close-modal">Cancel</button>
                    </div>
                </form>
            `);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
            modal.querySelector('#edit-user-form').onsubmit = async function (e) {
                e.preventDefault();
                const form = e.target;
                const data = {
                    full_name: form.full_name.value,
                    email: form.email.value
                };
                if (form.password.value) data.password = form.password.value;
                const res = await fetch(`/api/v1/auth/user/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    modal.remove();
                    loadUsers();
                } else {
                    alert(await readError(res));
                }
            };
        };
    });
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.onclick = async function () {
            const ok = await confirmModal({
                title: 'Delete user?',
                message: 'This permanently removes the user account.'
            });
            if (!ok) return;
            const res = await fetch(`/api/v1/auth/user/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) loadUsers();
            else alert(await readError(res));
        };
    });
}

function addUserModal() {
    const modal = createModal(`
        <h3 class="bnb-modal__title gradient-text">Add User</h3>
        <form id="add-user-form" class="bnb-modal__form">
            <input type="text" name="full_name" class="bnb-modal__field" placeholder="Full Name" required />
            <input type="email" name="email" class="bnb-modal__field" placeholder="Email" required />
            <input type="password" name="password" class="bnb-modal__field" placeholder="Password" required />
            <p class="text-xs" style="color:var(--bnb-muted);margin:0">Password needs 8+ chars, upper, lower, number, and symbol.</p>
            <div class="bnb-modal__actions">
                <button type="submit" class="bnb-btn bnb-btn--primary">Add</button>
                <button type="button" class="bnb-btn bnb-btn--ghost close-modal">Cancel</button>
            </div>
        </form>
    `);
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.querySelector('#add-user-form').onsubmit = async function (e) {
        e.preventDefault();
        const form = e.target;
        const data = {
            full_name: form.full_name.value,
            email: form.email.value,
            password: form.password.value
        };
        const res = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            modal.remove();
            loadUsers();
        } else {
            alert(await readError(res));
        }
    };
}
document.querySelector('.add-user-btn').onclick = addUserModal;
filterTable('search-users', 'users-table');

// --- CHATBOTS CRUD ---
async function loadChatbots() {
    const table = document.getElementById('chatbots-table');
    try {
        await Promise.all([
            usersCache.length ? Promise.resolve(usersCache) : fetchUsers(),
            tenantsCache.length ? Promise.resolve(tenantsCache) : fetchTenants()
        ]);
        const res = await fetch('/api/v1/chatbot/');
        if (!res.ok) throw new Error(await readError(res));
        const chatbots = await res.json();
        table.innerHTML = '';
        if (!chatbots.length) {
            table.innerHTML = '<tr><td colspan="5">No assistants yet.</td></tr>';
            return;
        }
        chatbots.forEach(bot => {
            const owner = findUser(bot.owner_id);
            const ownerText = bot.owner_email || (owner ? userLabel(owner) : '—');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(bot.name)}</td>
                <td>${escapeHtml(ownerText)}</td>
                <td>${escapeHtml(businessName(bot.business_profile_id))}</td>
                <td title="${escapeHtml(bot.prompt || '')}">${escapeHtml(truncate(bot.prompt, 72))}</td>
                <td class="flex gap-2">
                    <button type="button" class="edit-chatbot-btn bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                        data-id="${escapeHtml(bot.id)}"
                        data-owner-id="${escapeHtml(bot.owner_id || '')}"
                        data-business-id="${escapeHtml(bot.business_profile_id || '')}">Edit</button>
                    <button type="button" class="delete-chatbot-btn bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded text-xs" data-id="${escapeHtml(bot.id)}">Delete</button>
                </td>
            `;
            table.appendChild(tr);
        });
        bindChatbotActions();
    } catch (err) {
        table.innerHTML = `<tr><td colspan="5">${escapeHtml(err.message)}</td></tr>`;
    }
}

function bindChatbotActions() {
    document.querySelectorAll('.edit-chatbot-btn').forEach(btn => {
        btn.onclick = function () {
            const id = btn.dataset.id;
            const owner_id = btn.dataset.ownerId || '';
            const business_profile_id = btn.dataset.businessId || '';
            const row = btn.closest('tr');
            const name = row.children[0].innerText;
            const prompt = row.children[3].getAttribute('title') || row.children[3].innerText;
            const modal = createModal(`
                <h3 class="bnb-modal__title gradient-text">Edit Assistant</h3>
                <form id="edit-chatbot-form" class="bnb-modal__form">
                    <input type="text" name="name" class="bnb-modal__field" value="${escapeHtml(name)}" placeholder="Name" required />
                    <textarea name="prompt" class="bnb-modal__field" placeholder="Prompt">${escapeHtml(prompt)}</textarea>
                    <div class="bnb-modal__actions">
                        <button type="submit" class="bnb-btn bnb-btn--primary">Save</button>
                        <button type="button" class="bnb-btn bnb-btn--ghost close-modal">Cancel</button>
                    </div>
                </form>
            `);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
            modal.querySelector('#edit-chatbot-form').onsubmit = async function (e) {
                e.preventDefault();
                const form = e.target;
                const data = {
                    name: form.name.value,
                    prompt: form.prompt.value,
                    owner_id,
                    business_profile_id
                };
                const res = await fetch(`/api/v1/chatbot/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    modal.remove();
                    loadChatbots();
                    loadSuggestions();
                } else {
                    alert(await readError(res));
                }
            };
        };
    });
    document.querySelectorAll('.delete-chatbot-btn').forEach(btn => {
        btn.onclick = async function () {
            const ok = await confirmModal({
                title: 'Delete assistant?',
                message: 'This removes the assistant and its suggestions.'
            });
            if (!ok) return;
            const res = await fetch(`/api/v1/chatbot/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) {
                loadChatbots();
                loadSuggestions();
            } else {
                alert(await readError(res));
            }
        };
    });
}

async function addChatbotModal() {
    try {
        await Promise.all([fetchUsers(), fetchTenants()]);
    } catch (err) {
        return alert(err.message);
    }
    const ownerOptions = usersCache.map(u =>
        `<option value="${escapeHtml(u.id)}">${escapeHtml(userLabel(u))}</option>`
    ).join('');
    const businessOptions = tenantsCache.map(t =>
        `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`
    ).join('');
    const modal = createModal(`
        <h3 class="bnb-modal__title gradient-text">Add Assistant</h3>
        <form id="add-chatbot-form" class="bnb-modal__form">
            <input type="text" name="name" class="bnb-modal__field" placeholder="Name" required />
            <label class="text-xs" style="color:var(--bnb-muted)">Owner</label>
            <select name="owner_id" class="bnb-modal__field" required>
                <option value="">Select owner</option>
                ${ownerOptions}
            </select>
            <label class="text-xs" style="color:var(--bnb-muted)">Business</label>
            <select name="business_profile_id" class="bnb-modal__field" required>
                <option value="">Select business</option>
                ${businessOptions}
            </select>
            <textarea name="prompt" class="bnb-modal__field" placeholder="Prompt"></textarea>
            <div class="bnb-modal__actions">
                <button type="submit" class="bnb-btn bnb-btn--primary">Add</button>
                <button type="button" class="bnb-btn bnb-btn--ghost close-modal">Cancel</button>
            </div>
        </form>
    `);
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.querySelector('#add-chatbot-form').onsubmit = async function (e) {
        e.preventDefault();
        const form = e.target;
        const data = {
            name: form.name.value,
            owner_id: form.owner_id.value,
            business_profile_id: form.business_profile_id.value,
            prompt: form.prompt.value
        };
        const res = await fetch('/api/v1/chatbot/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            modal.remove();
            loadChatbots();
            loadSuggestions();
        } else {
            alert(await readError(res));
        }
    };
}
document.querySelector('.add-chatbot-btn').onclick = addChatbotModal;
filterTable('search-chatbots', 'chatbots-table');

// --- SUGGESTIONS ---
async function loadSuggestions() {
    const table = document.getElementById('suggestions-table');
    try {
        if (!usersCache.length) await fetchUsers();
        const res = await fetch('/api/v1/chatbot/');
        if (!res.ok) throw new Error(await readError(res));
        const chatbots = await res.json();
        table.innerHTML = '';
        let rows = 0;
        for (const bot of chatbots) {
            const owner = findUser(bot.owner_id);
            const ownerText = bot.owner_email || (owner ? userLabel(owner) : '—');
            const resSug = await fetch(`/api/v1/chatbot/${bot.id}/suggestions`);
            let suggestionText = 'None yet';
            if (resSug.ok) {
                const suggestion = await resSug.json();
                const values = Object.values(suggestion.suggestions || {});
                if (values.length) suggestionText = values.join(' · ');
            }
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(bot.name)}</td>
                <td>${escapeHtml(ownerText)}</td>
                <td>${escapeHtml(suggestionText)}</td>
                <td class="flex gap-2">
                    <button type="button" class="edit-suggestion-btn bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs" data-id="${escapeHtml(bot.id)}">Edit</button>
                </td>
            `;
            table.appendChild(tr);
            rows += 1;
        }
        if (!rows) table.innerHTML = '<tr><td colspan="4">No assistants yet. Create one first.</td></tr>';
        bindSuggestionActions();
    } catch (err) {
        table.innerHTML = `<tr><td colspan="4">${escapeHtml(err.message)}</td></tr>`;
    }
}

function bindSuggestionActions() {
    document.querySelectorAll('.edit-suggestion-btn').forEach(btn => {
        btn.onclick = async function () {
            const chatbot_id = btn.dataset.id;
            const res = await fetch(`/api/v1/chatbot/${chatbot_id}/suggestions`);
            let suggestions = {};
            if (res.ok) {
                const suggestion = await res.json();
                suggestions = suggestion.suggestions || {};
            }
            const modal = createModal(`
                <h3 class="bnb-modal__title gradient-text">Edit Suggestions</h3>
                <form id="edit-suggestion-form" class="bnb-modal__form">
                    <textarea name="suggestions" class="bnb-modal__field" placeholder="One suggestion per line">${escapeHtml(Object.values(suggestions).join('\n'))}</textarea>
                    <div class="bnb-modal__actions">
                        <button type="submit" class="bnb-btn bnb-btn--primary">Save</button>
                        <button type="button" class="bnb-btn bnb-btn--ghost close-modal">Cancel</button>
                    </div>
                </form>
            `);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
            modal.querySelector('#edit-suggestion-form').onsubmit = async function (e) {
                e.preventDefault();
                const form = e.target;
                const lines = form.suggestions.value.split('\n').map(s => s.trim()).filter(Boolean);
                const data = { suggestions: {}, chatbot_id };
                lines.forEach((line, i) => { data.suggestions[`q${i + 1}`] = line; });
                const res2 = await fetch(`/api/v1/chatbot/${chatbot_id}/suggestions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res2.ok) {
                    modal.remove();
                    loadSuggestions();
                } else {
                    alert(await readError(res2));
                }
            };
        };
    });
}
document.querySelector('.add-suggestion-btn').onclick = () =>
    alert('Open an assistant in Suggestions and use Edit, or create an assistant first.');
filterTable('search-suggestions', 'suggestions-table');

// --- TENANTS ---
async function loadTenants() {
    const table = document.getElementById('tenants-table');
    try {
        await Promise.all([fetchTenants(), usersCache.length ? Promise.resolve(usersCache) : fetchUsers()]);
        table.innerHTML = '';
        if (!tenantsCache.length) {
            table.innerHTML = '<tr><td colspan="4">No businesses yet.</td></tr>';
            return;
        }
        tenantsCache.forEach(t => {
            const owner = usersCache.find(u => u.business_profile_id === t.id);
            const ownerText = t.owner_email || (owner ? userLabel(owner) : '—');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(t.name)}</td>
                <td>${escapeHtml(ownerText)}</td>
                <td>${formatSettingsHtml(t.settings)}</td>
                <td class="flex gap-2">
                    <button type="button" class="edit-tenant-btn bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs" data-id="${escapeHtml(t.id)}">Edit</button>
                    <button type="button" class="delete-tenant-btn bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded text-xs" data-id="${escapeHtml(t.id)}">Delete</button>
                </td>
            `;
            table.appendChild(tr);
        });
        bindTenantActions();
    } catch (err) {
        table.innerHTML = `<tr><td colspan="4">${escapeHtml(err.message)}</td></tr>`;
    }
}

function bindTenantActions() {
    document.querySelectorAll('.edit-tenant-btn').forEach(btn => {
        btn.onclick = function () {
            const id = btn.dataset.id;
            const tenant = tenantsCache.find(t => t.id === id);
            if (!tenant) return alert('Business not found.');
            const settings = tenant.settings || {};
            const fieldRows = Object.keys(settings).length
                ? Object.entries(settings).map(([key, value]) => `
                    <div class="bnb-settings-edit-row">
                      <label>${escapeHtml(humanizeKey(key))}</label>
                      <input type="text" class="bnb-modal__field" name="setting__${escapeHtml(key)}" value="${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value)}" />
                    </div>`).join('')
                : `<p class="text-xs" style="color:var(--bnb-muted);margin:0">No settings yet. Add key/value pairs below.</p>`;
            const modal = createModal(`
                <h3 class="bnb-modal__title gradient-text">Edit Business</h3>
                <form id="edit-tenant-form" class="bnb-modal__form">
                    <input type="text" name="name" class="bnb-modal__field" value="${escapeHtml(tenant.name)}" placeholder="Name" required />
                    <div class="bnb-settings-edit">${fieldRows}</div>
                    <div class="bnb-settings-edit-row">
                      <label>Add setting key</label>
                      <input type="text" class="bnb-modal__field" name="new_key" placeholder="e.g. contact_email" />
                    </div>
                    <div class="bnb-settings-edit-row">
                      <label>Add setting value</label>
                      <input type="text" class="bnb-modal__field" name="new_value" placeholder="e.g. hello@acme.example" />
                    </div>
                    <div class="bnb-modal__actions">
                        <button type="submit" class="bnb-btn bnb-btn--primary">Save</button>
                        <button type="button" class="bnb-btn bnb-btn--ghost close-modal">Cancel</button>
                    </div>
                </form>
            `);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
            modal.querySelector('#edit-tenant-form').onsubmit = async function (e) {
                e.preventDefault();
                const form = e.target;
                const nextSettings = {};
                Array.from(form.elements).forEach(el => {
                    if (!el.name || !el.name.startsWith('setting__')) return;
                    const key = el.name.slice('setting__'.length);
                    if (!key) return;
                    nextSettings[key] = el.value;
                });
                const newKey = (form.new_key.value || '').trim();
                const newValue = (form.new_value.value || '').trim();
                if (newKey) nextSettings[newKey] = newValue;
                const res = await fetch(`/api/v1/tenant/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: form.name.value, settings: nextSettings })
                });
                if (res.ok) {
                    modal.remove();
                    loadTenants();
                    loadUsers();
                    loadChatbots();
                } else {
                    alert(await readError(res));
                }
            };
        };
    });
    document.querySelectorAll('.delete-tenant-btn').forEach(btn => {
        btn.onclick = async function () {
            const ok = await confirmModal({
                title: 'Delete business?',
                message: 'This permanently removes the business profile.'
            });
            if (!ok) return;
            const res = await fetch(`/api/v1/tenant/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) {
                loadTenants();
                loadUsers();
                loadChatbots();
            } else {
                alert(await readError(res));
            }
        };
    });
}

function addTenantModal() {
    const modal = createModal(`
        <h3 class="bnb-modal__title gradient-text">Add Business</h3>
        <form id="add-tenant-form" class="bnb-modal__form">
            <input type="text" name="name" class="bnb-modal__field" placeholder="Business name" required />
            <div class="bnb-settings-edit-row">
              <label>Industry (optional)</label>
              <input type="text" name="industry" class="bnb-modal__field" placeholder="e.g. E-commerce" />
            </div>
            <div class="bnb-settings-edit-row">
              <label>Contact email (optional)</label>
              <input type="email" name="contact_email" class="bnb-modal__field" placeholder="hello@company.com" />
            </div>
            <div class="bnb-settings-edit-row">
              <label>Support hours (optional)</label>
              <input type="text" name="support_hours" class="bnb-modal__field" placeholder="e.g. 24/7 or Mon–Fri 9–5" />
            </div>
            <div class="bnb-modal__actions">
                <button type="submit" class="bnb-btn bnb-btn--primary">Add</button>
                <button type="button" class="bnb-btn bnb-btn--ghost close-modal">Cancel</button>
            </div>
        </form>
    `);
    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.querySelector('#add-tenant-form').onsubmit = async function (e) {
        e.preventDefault();
        const form = e.target;
        const settings = {};
        ['industry', 'contact_email', 'support_hours'].forEach(key => {
            const val = (form[key].value || '').trim();
            if (val) settings[key] = val;
        });
        const res = await fetch('/api/v1/tenant/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: form.name.value, settings })
        });
        if (res.ok) {
            modal.remove();
            loadTenants();
        } else {
            alert(await readError(res));
        }
    };
}
document.querySelector('.add-tenant-btn').onclick = addTenantModal;
filterTable('search-tenants', 'tenants-table');

// --- DOCUMENTS ---
async function loadDocuments() {
    const table = document.getElementById('documents-table');
    try {
        if (!tenantsCache.length) await fetchTenants();
        table.innerHTML = '';
        let rows = 0;
        for (const t of tenantsCache) {
            const docsRes = await fetch(`/api/v1/tenant/business-document/?business_profile_id=${t.id}`);
            if (!docsRes.ok) continue;
            const docs = await docsRes.json();
            docs.forEach(doc => {
                const uploaded = doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : '—';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(doc.filename || doc.url || 'Untitled')}</td>
                    <td>${escapeHtml(doc.type || '—')}</td>
                    <td>${escapeHtml(t.name)}</td>
                    <td>${escapeHtml(uploaded)}</td>
                    <td class="flex gap-2">
                        <button type="button" class="view-document-btn bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs" data-id="${escapeHtml(doc.id)}">View</button>
                        <button type="button" class="delete-document-btn bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded text-xs" data-id="${escapeHtml(doc.id)}">Delete</button>
                        <a href="/api/v1/tenant/business-document/${escapeHtml(doc.id)}/download" class="bg-green-500 hover:bg-green-700 text-white px-2 py-1 rounded text-xs" target="_blank" rel="noopener">Download</a>
                    </td>
                `;
                table.appendChild(tr);
                rows += 1;
            });
        }
        if (!rows) table.innerHTML = '<tr><td colspan="5">No documents yet.</td></tr>';
        bindDocumentActions();
        bindViewDocumentActions();
    } catch (err) {
        table.innerHTML = `<tr><td colspan="5">${escapeHtml(err.message)}</td></tr>`;
    }
}

function bindDocumentActions() {
    document.querySelectorAll('.delete-document-btn').forEach(btn => {
        btn.onclick = async function () {
            const ok = await confirmModal({
                title: 'Delete document?',
                message: 'This permanently removes the uploaded file.'
            });
            if (!ok) return;
            const res = await fetch(`/api/v1/tenant/business-document/${btn.dataset.id}`, { method: 'DELETE' });
            if (res.ok) loadDocuments();
            else alert(await readError(res));
        };
    });
}

function bindViewDocumentActions() {
    document.querySelectorAll('.view-document-btn').forEach(btn => {
        btn.onclick = async function () {
            const res = await fetch(`/api/v1/tenant/business-document/${btn.dataset.id}/preview`);
            if (!res.ok) return alert(await readError(res));
            const data = await res.json();
            let content = '';
            if (data.text) {
                content = `<pre style="max-height:400px;overflow:auto">${escapeHtml(data.text)}</pre>`;
            } else if (data.rows) {
                content = '<table class="w-full text-xs">' + data.rows.map(row =>
                    `<tr>${row.map(cell => `<td class="border px-1">${escapeHtml(cell)}</td>`).join('')}</tr>`
                ).join('') + '</table>';
            } else if (data.error) {
                content = `<div style="color:var(--bnb-danger)">Error: ${escapeHtml(data.error)}</div>`;
            } else {
                content = '<div>No extracted data available.</div>';
            }
            createModal(`<h3 class="bnb-modal__title gradient-text">Extracted Data</h3>${content}`);
        };
    });
}

function addDocumentModal() {
    fetchTenants().then(tenants => {
        const modal = createModal(`
            <h3 class="bnb-modal__title gradient-text">Add Document</h3>
            <form id="add-document-form" class="bnb-modal__form">
                <select name="business_profile_id" class="bnb-modal__field" required>
                    <option value="">Select business</option>
                    ${tenants.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('')}
                </select>
                <input type="text" name="type" class="bnb-modal__field" placeholder="Type (e.g. pdf, csv)" required />
                <input type="file" name="file" class="bnb-modal__field" />
                <input type="url" name="url" class="bnb-modal__field" placeholder="Or enter URL" />
                <div class="bnb-modal__actions">
                    <button type="submit" class="bnb-btn bnb-btn--primary">Add</button>
                    <button type="button" class="bnb-btn bnb-btn--ghost close-modal">Cancel</button>
                </div>
            </form>
        `);
        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.querySelector('#add-document-form').onsubmit = async function (e) {
            e.preventDefault();
            const form = e.target;
            if (!form.file.files.length && !form.url.value) {
                alert('Choose a file or enter a URL.');
                return;
            }
            const formData = new FormData(form);
            const res = await fetch('/api/v1/tenant/business-document/', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                modal.remove();
                loadDocuments();
            } else {
                alert(await readError(res));
            }
        };
    }).catch(err => alert(err.message));
}
document.querySelector('.add-document-btn').onclick = addDocumentModal;
filterTable('search-documents', 'documents-table');

window.addEventListener('DOMContentLoaded', () => {
    loadTenants().then(() => {
        loadUsers();
        loadChatbots();
        loadSuggestions();
        loadDocuments();
    }).catch(() => {
        loadUsers();
        loadChatbots();
        loadSuggestions();
        loadDocuments();
    });
});
