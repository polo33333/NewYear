// API Base URL
const API_BASE = '';

// State
let users = [];
let rewards = [];
let confirmCallback = null;

// DOM Elements
const usersTbody = document.getElementById('users-tbody');
const rewardsTbody = document.getElementById('rewards-tbody');
const totalUsersEl = document.getElementById('total-users');
const playedUsersEl = document.getElementById('played-users');
const claimedUsersEl = document.getElementById('claimed-users');
const totalProbabilityEl = document.getElementById('total-probability');
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');
const toast = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    checkAuth();

    loadUsers();
    loadRewards();

    // Event listeners
    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadUsers();
        loadRewards();
    });

    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('add-reward-btn').addEventListener('click', addReward);
    document.getElementById('save-rewards-btn').addEventListener('click', saveRewards);
    document.getElementById('reset-quantities-btn').addEventListener('click', resetQuantities);

    confirmYes.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        hideConfirmModal();
    });

    confirmNo.addEventListener('click', hideConfirmModal);
});

// Check Authentication
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/status`);
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/admin/login';
            return;
        }

        // Display username
        const usernameEl = document.getElementById('admin-username');
        if (usernameEl && data.username) {
            usernameEl.textContent = `👤 ${data.username}`;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/admin/login';
    }
}

// Handle Logout
async function handleLogout() {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = '/admin/login';
        } else {
            showToast('Đăng xuất thất bại', 'error');
        }
    } catch (error) {
        showToast('Lỗi khi đăng xuất', 'error');
        console.error(error);
    }
}

// Load Users
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/users`);
        users = await response.json();

        renderUsers();
        updateStats();
    } catch (error) {
        showToast('Lỗi khi tải danh sách người chơi', 'error');
        console.error(error);
    }
}

// Render Users Table
function renderUsers() {
    if (users.length === 0) {
        usersTbody.innerHTML = '<tr><td colspan="7" class="loading">Chưa có người chơi nào</td></tr>';
        return;
    }

    usersTbody.innerHTML = users.map(user => {
        const bestReward = user.rewards.length > 0
            ? user.rewards.reduce((prev, current) => (prev.value > current.value) ? prev : current)
            : null;

        const rewardsText = user.rewards.length > 0
            ? user.rewards.map(r => formatCurrency(r.value)).join(', ')
            : '-';

        const firstSeen = user.firstSeen
            ? new Date(user.firstSeen).toLocaleString('vi-VN')
            : '-';

        return `
            <tr>
                <td><code>${user.ip}</code></td>
                <td><strong>${user.attempts}/3</strong></td>
                <td>${rewardsText}</td>
                <td>${bestReward ? formatCurrency(bestReward.value) : '-'}</td>
                <td>
                    ${user.claimed
                ? '<span class="badge badge-success">✓ Đã nhận</span>'
                : '<span class="badge badge-danger">✗ Chưa nhận</span>'}
                </td>
                <td>${firstSeen}</td>
                <td class="actions">
                    <button class="btn btn-warning btn-sm" onclick="resetUser('${user.ip}')">
                        🔄 Reset
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.ip}')">
                        🗑️ Xóa
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Update Statistics
function updateStats() {
    totalUsersEl.textContent = users.length;
    playedUsersEl.textContent = users.filter(u => u.attempts > 0).length;
    claimedUsersEl.textContent = users.filter(u => u.claimed).length;
}

// Delete User
function deleteUser(ip) {
    showConfirmModal(
        'Xóa Người Chơi',
        `Bạn có chắc chắn muốn xóa người chơi với IP: ${ip}?`,
        async () => {
            try {
                const response = await fetch(`${API_BASE}/api/admin/user/${encodeURIComponent(ip)}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (response.ok) {
                    showToast(data.message, 'success');
                    loadUsers();
                } else {
                    showToast(data.message, 'error');
                }
            } catch (error) {
                showToast('Lỗi khi xóa người chơi', 'error');
                console.error(error);
            }
        }
    );
}

// Reset User
function resetUser(ip) {
    showConfirmModal(
        'Reset Lượt Chơi',
        `Bạn có chắc chắn muốn reset lượt chơi cho IP: ${ip}?`,
        async () => {
            try {
                const response = await fetch(`${API_BASE}/api/admin/user/${encodeURIComponent(ip)}/reset`, {
                    method: 'POST'
                });

                const data = await response.json();

                if (response.ok) {
                    showToast(data.message, 'success');
                    loadUsers();
                } else {
                    showToast(data.message, 'error');
                }
            } catch (error) {
                showToast('Lỗi khi reset người chơi', 'error');
                console.error(error);
            }
        }
    );
}

// Load Rewards
async function loadRewards() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/rewards`);
        rewards = await response.json();

        renderRewards();
        updateProbabilitySum();
    } catch (error) {
        showToast('Lỗi khi tải cấu hình phần thưởng', 'error');
        console.error(error);
    }
}

// Render Rewards Table
function renderRewards() {
    if (rewards.length === 0) {
        rewardsTbody.innerHTML = '<tr><td colspan="9" class="loading">Chưa có phần thưởng nào</td></tr>';
        return;
    }

    rewardsTbody.innerHTML = rewards.map((reward, index) => {
        const distributed = reward.quantity - reward.remaining;
        const percentage = (reward.remaining / reward.quantity) * 100;

        // Color indicator based on remaining percentage
        let indicator = '🟢'; // Green
        if (percentage === 0) indicator = '⚫'; // Black (out of stock)
        else if (percentage < 10) indicator = '🔴'; // Red
        else if (percentage < 50) indicator = '🟡'; // Yellow

        return `
        <tr data-index="${index}">
            <td><strong style="font-size: 16px; color: #2563eb;">#${reward.id}</strong></td>
            <td><input type="text" value="${reward.name}" class="reward-name" /></td>
            <td><input type="number" value="${reward.value}" class="reward-value" /></td>
            <td><input type="text" value="${reward.linkReward || ''}" class="reward-link" /></td>
            <td><input type="number" step="0.01" min="0" max="1" value="${reward.probability}" class="reward-probability" onchange="updateProbabilitySum()" /></td>
            <td><input type="number" min="0" value="${reward.quantity}" class="reward-quantity" /></td>
            <td><input type="number" min="0" value="${reward.remaining}" class="reward-remaining" /></td>
            <td><strong>${indicator} ${distributed}</strong></td>
            <td class="actions">
                <button class="btn btn-danger btn-sm" onclick="removeReward(${index})">
                    🗑️ Xóa
                </button>
            </td>
        </tr>
    `;
    }).join('');
}

// Add Reward
function addReward() {
    const newReward = {
        id: rewards.length + 1,
        name: "Phần thưởng mới",
        value: 10000,
        linkReward: "",
        probability: 0.1,
        quantity: 100,
        remaining: 100
    };

    rewards.push(newReward);
    renderRewards();
    updateProbabilitySum();
    showToast('Đã thêm phần thưởng mới', 'success');
}

// Remove Reward
function removeReward(index) {
    showConfirmModal(
        'Xóa Phần Thưởng',
        `Bạn có chắc chắn muốn xóa phần thưởng "${rewards[index].name}"?`,
        () => {
            rewards.splice(index, 1);
            renderRewards();
            updateProbabilitySum();
            showToast('Đã xóa phần thưởng', 'success');
        }
    );
}

// Update Probability Sum
function updateProbabilitySum() {
    const inputs = document.querySelectorAll('.reward-probability');
    let total = 0;

    inputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });

    totalProbabilityEl.textContent = total.toFixed(2);

    if (Math.abs(total - 1.0) > 0.01) {
        totalProbabilityEl.classList.add('invalid');
    } else {
        totalProbabilityEl.classList.remove('invalid');
    }
}

// Save Rewards
async function saveRewards() {
    // Collect data from inputs
    const rows = document.querySelectorAll('#rewards-tbody tr');
    const updatedRewards = [];

    rows.forEach((row, index) => {
        const id = rewards[index].id; // Use ID from original data (readonly)
        const name = row.querySelector('.reward-name').value;
        const value = parseInt(row.querySelector('.reward-value').value);
        const linkReward = row.querySelector('.reward-link').value;
        const probability = parseFloat(row.querySelector('.reward-probability').value);
        const quantity = parseInt(row.querySelector('.reward-quantity').value);
        const remaining = parseInt(row.querySelector('.reward-remaining').value);

        updatedRewards.push({ id, name, value, linkReward, probability, quantity, remaining });
    });

    // Validate probability sum
    const totalProb = updatedRewards.reduce((sum, r) => sum + r.probability, 0);
    if (Math.abs(totalProb - 1.0) > 0.01) {
        showToast(`Tổng xác suất phải bằng 1.0 (hiện tại: ${totalProb.toFixed(2)})`, 'error');
        return;
    }

    // Validate quantities
    for (const reward of updatedRewards) {
        if (reward.remaining > reward.quantity) {
            showToast(`"${reward.name}": Số lượng còn lại không thể lớn hơn tổng số lượng`, 'error');
            return;
        }
    }

    try {
        const response = await fetch(`${API_BASE}/api/admin/rewards`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ rewards: updatedRewards })
        });

        const data = await response.json();

        if (response.ok) {
            rewards = data.rewards;
            showToast(data.message, 'success');
            loadRewards();
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Lỗi khi lưu cấu hình phần thưởng', 'error');
        console.error(error);
    }
}

// Show Confirm Modal
function showConfirmModal(title, message, callback) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmCallback = callback;
    confirmModal.classList.remove('hidden');
}

// Hide Confirm Modal
function hideConfirmModal() {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
}

// Reset Quantities
async function resetQuantities() {
    showConfirmModal(
        'Reset Số Lượng Phần Thưởng',
        'Bạn có chắc chắn muốn reset tất cả số lượng phần thưởng về ban đầu?',
        async () => {
            try {
                const response = await fetch(`${API_BASE}/api/admin/rewards/reset`, {
                    method: 'POST'
                });

                const data = await response.json();

                if (response.ok) {
                    showToast(data.message, 'success');
                    loadRewards();
                } else {
                    showToast(data.message || 'Lỗi khi reset số lượng', 'error');
                }
            } catch (error) {
                showToast('Lỗi khi reset số lượng phần thưởng', 'error');
                console.error(error);
            }
        }
    );
}

// Show Toast
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type}`;

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Format Currency
function formatCurrency(value) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(value);
}
