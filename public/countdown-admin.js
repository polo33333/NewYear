
// Countdown Configuration
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
            
            statusText.innerHTML =  Đếm ngược đang hoạt động<br>Kết thúc: <br>Còn lại:  ngày  giờ  phút;
            statusText.style.color = '#28a745';
            
            // Set datetime input value
            const year = endDate.getFullYear();
            const month = String(endDate.getMonth() + 1).padStart(2, '0');
            const day = String(endDate.getDate()).padStart(2, '0');
            const hour = String(endDate.getHours()).padStart(2, '0');
            const minute = String(endDate.getMinutes()).padStart(2, '0');
            datetimeInput.value = ${year}--T:;
        } else {
            statusText.textContent = ' Không có đếm ngược đang hoạt động';
            statusText.style.color = '#6c757d';
            datetimeInput.value = '';
        }
    } catch (err) {
        console.error('Error loading countdown:', err);
        document.getElementById('countdown-status-text').textContent = ' Lỗi tải dữ liệu';
    }
}

document.getElementById('save-countdown-btn').addEventListener('click', async () => {
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
        console.error('Error saving countdown:', err);
        showToast('Lỗi khi lưu cấu hình!', 'error');
    }
});

document.getElementById('clear-countdown-btn').addEventListener('click', async () => {
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
        console.error('Error clearing countdown:', err);
        showToast('Lỗi khi xóa đếm ngược!', 'error');
    }
});
