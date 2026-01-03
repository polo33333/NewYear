// Toast notification function
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// ==================== COUNTDOWN MANAGEMENT ====================

async function loadCountdownStatus() {
    try {
        const res = await fetch('/api/countdown');
        const data = await res.json();

        const statusText = document.getElementById('countdown-status-text');
        const datetimeInput = document.getElementById('countdown-datetime');

        if (data.isActive && data.countdownEndTime > 0) {
            const endDate = new Date(data.countdownEndTime);
            const days = Math.floor(data.remainingMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((data.remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((data.remainingMs % (1000 * 60 * 60)) / (1000 * 60));

            statusText.innerHTML = `✅ Đếm ngược đang hoạt động<br>Kết thúc: ${endDate.toLocaleString('vi-VN')}<br>Còn lại: ${days} ngày ${hours} giờ ${minutes} phút`;
            statusText.style.color = '#28a745';

            const year = endDate.getFullYear();
            const month = String(endDate.getMonth() + 1).padStart(2, '0');
            const day = String(endDate.getDate()).padStart(2, '0');
            const hour = String(endDate.getHours()).padStart(2, '0');
            const minute = String(endDate.getMinutes()).padStart(2, '0');
            datetimeInput.value = `${year}-${month}-${day}T${hour}:${minute}`;
        } else {
            statusText.textContent = '⏸️ Không có đếm ngược đang hoạt động';
            statusText.style.color = '#6c757d';
            datetimeInput.value = '';
        }
    } catch (err) {
        const statusText = document.getElementById('countdown-status-text');
        if (statusText) {
            statusText.textContent = '❌ Lỗi tải dữ liệu';
        }
    }
}

// ==================== REWARDS MANAGEMENT ====================

let rewardsData = [];

async function loadRewards() {
    try {
        const res = await fetch('/api/admin/rewards');
        const data = await res.json();
        rewardsData = data;
        renderRewards();
        updateProbabilitySum();
    } catch (err) {
        console.error('Error loading rewards:', err);
        showToast('Lỗi tải danh sách phần thưởng', 'error');
    }
}

function renderRewards() {
    const tbody = document.getElementById('rewards-tbody');
    if (!tbody) return;

    if (rewardsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Chưa có phần thưởng nào</td></tr>';
        return;
    }

    tbody.innerHTML = rewardsData.map((reward, index) => `
        <tr>
            <td>${reward.id}</td>
            <td><input type="text" value="${reward.name}" data-index="${index}" data-field="name"></td>
            <td><input type="number" value="${reward.value}" data-index="${index}" data-field="value"></td>
            <td><input type="text" value="${reward.linkReward || ''}" data-index="${index}" data-field="linkReward"></td>
            <td><input type="number" step="0.01" value="${reward.probability}" data-index="${index}" data-field="probability"></td>
            <td><input type="number" value="${reward.quantity}" data-index="${index}" data-field="quantity"></td>
            <td><input type="number" value="${reward.remaining}" data-index="${index}" data-field="remaining"></td>
            <td>${reward.quantity - reward.remaining}</td>
            <td class="actions">
                <button class="btn btn-sm btn-danger" onclick="deleteReward(${index})">🗑️</button>
            </td>
        </tr>
    `).join('');

    // Add event listeners for input changes
    tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', handleRewardChange);
    });
}

function handleRewardChange(e) {
    const index = parseInt(e.target.dataset.index);
    const field = e.target.dataset.field;
    let value = e.target.value;

    if (field === 'value' || field === 'quantity' || field === 'remaining') {
        value = parseInt(value);
    } else if (field === 'probability') {
        value = parseFloat(value);
    }

    rewardsData[index][field] = value;
    updateProbabilitySum();
}

function updateProbabilitySum() {
    const sum = rewardsData.reduce((total, r) => total + parseFloat(r.probability || 0), 0);
    const sumElement = document.getElementById('total-probability');
    if (sumElement) {
        sumElement.textContent = sum.toFixed(2);
        sumElement.className = Math.abs(sum - 1.0) < 0.01 ? '' : 'invalid';
    }
}

function deleteReward(index) {
    if (!confirm('Bạn có chắc muốn xóa phần thưởng này?')) return;
    rewardsData.splice(index, 1);
    renderRewards();
    updateProbabilitySum();
}

async function saveRewards() {
    try {
        const res = await fetch('/api/admin/rewards', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rewards: rewardsData })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            loadRewards();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Lỗi khi lưu cấu hình!', 'error');
    }
}

function addReward() {
    const newId = rewardsData.length > 0
        ? Math.max(...rewardsData.map(r => r.id)) + 1
        : 1;

    const newReward = {
        id: newId,
        name: 'Phần thưởng mới',
        value: 0,
        linkReward: '',
        probability: 0.1,
        quantity: 100,
        remaining: 100
    };

    rewardsData.push(newReward);
    renderRewards();
    updateProbabilitySum();
    showToast('Đã thêm phần thưởng mới', 'success');
}

async function resetQuantities() {
    if (!confirm('Bạn có chắc muốn reset số lượng tất cả phần thưởng về ban đầu?')) return;

    try {
        const res = await fetch('/api/admin/rewards/reset', {
            method: 'POST'
        });

        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            loadRewards();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Lỗi khi reset số lượng!', 'error');
    }
}

// ==================== USERS MANAGEMENT ====================

async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users');
        const users = await res.json();
        renderUsers(users);
    } catch (err) {
        console.error('Error loading users:', err);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">Chưa có người chơi nào</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const best = user.rewards.length > 0
            ? user.rewards.reduce((a, b) => a.value > b.value ? a : b)
            : null;

        return `
            <tr>
                <td>${user.ip}</td>
                <td>${user.attempts}</td>
                <td>${user.rewards.length}</td>
                <td>${best ? best.name : '-'}</td>
                <td>${user.claimed ? '✅' : '❌'}</td>
                <td>${new Date(user.firstSeen).toLocaleString('vi-VN')}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-warning" onclick="resetUser('${user.ip}')">🔄</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.ip}')">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    // Update stats
    document.getElementById('total-users').textContent = users.length;
    document.getElementById('played-users').textContent = users.filter(u => u.attempts > 0).length;
    document.getElementById('claimed-users').textContent = users.filter(u => u.claimed).length;
}

async function resetUser(ip) {
    if (!confirm('Bạn có chắc muốn reset lượt chơi của người này?')) return;

    try {
        const res = await fetch(`/api/admin/user/${encodeURIComponent(ip)}/reset`, {
            method: 'POST'
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            loadUsers();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Lỗi khi reset!', 'error');
    }
}

async function deleteUser(ip) {
    if (!confirm('Bạn có chắc muốn xóa người chơi này?')) return;

    try {
        const res = await fetch(`/api/admin/user/${encodeURIComponent(ip)}`, {
            method: 'DELETE'
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.message, 'success');
            loadUsers();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Lỗi khi xóa!', 'error');
    }
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    // Load data
    loadUsers();
    loadRewards();

    if (document.getElementById('countdown-datetime')) {
        loadCountdownStatus();
    }

    // Countdown save button
    const saveCountdownBtn = document.getElementById('save-countdown-btn');
    if (saveCountdownBtn) {
        saveCountdownBtn.addEventListener('click', async () => {
            const datetimeInput = document.getElementById('countdown-datetime');
            const datetime = datetimeInput.value;

            if (!datetime) {
                showToast('Vui lòng chọn thời gian!', 'error');
                return;
            }

            const endTime = new Date(datetime).getTime();

            if (endTime <= Date.now()) {
                showToast('Thời gian phải ở tương lai!', 'error');
                return;
            }

            try {
                const res = await fetch('/api/admin/countdown', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endTime })
                });

                const data = await res.json();

                if (res.ok) {
                    showToast(data.message, 'success');
                    loadCountdownStatus();
                } else {
                    showToast(data.message, 'error');
                }
            } catch (err) {
                showToast('Lỗi khi lưu cấu hình!', 'error');
            }
        });
    }

    // Countdown clear button
    const clearCountdownBtn = document.getElementById('clear-countdown-btn');
    if (clearCountdownBtn) {
        clearCountdownBtn.addEventListener('click', async () => {
            if (!confirm('Bạn có chắc muốn xóa đếm ngược?')) return;

            try {
                const res = await fetch('/api/admin/countdown', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endTime: 0 })
                });

                const data = await res.json();

                if (res.ok) {
                    showToast('Đã xóa đếm ngược!', 'success');
                    loadCountdownStatus();
                } else {
                    showToast(data.message, 'error');
                }
            } catch (err) {
                showToast('Lỗi khi xóa đếm ngược!', 'error');
            }
        });
    }

    // Rewards save button
    const saveRewardsBtn = document.getElementById('save-rewards-btn');
    if (saveRewardsBtn) {
        saveRewardsBtn.addEventListener('click', saveRewards);
    }

    // Add reward button
    const addRewardBtn = document.getElementById('add-reward-btn');
    if (addRewardBtn) {
        addRewardBtn.addEventListener('click', addReward);
    }

    // Reset quantities button
    const resetQuantitiesBtn = document.getElementById('reset-quantities-btn');
    if (resetQuantitiesBtn) {
        resetQuantitiesBtn.addEventListener('click', resetQuantities);
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadUsers();
            loadRewards();
            if (document.getElementById('countdown-datetime')) {
                loadCountdownStatus();
            }
            showToast('Đã làm mới dữ liệu', 'success');
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!confirm('Bạn có chắc muốn đăng xuất?')) return;

            try {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/admin/login';
            } catch (err) {
                console.error('Logout error:', err);
            }
        });
    }
});
