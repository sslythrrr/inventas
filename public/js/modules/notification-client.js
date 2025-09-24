function updateNotificationBadge(count) {
    const badge = document.querySelector('.badge-counter');
    if (badge) {
        badge.textContent = count > 0 ? (count > 99 ? '99+' : count) : '';
    }
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } else if (days > 0) {
        return `${days} hari yang lalu`;
    } else if (hours > 0) {
        return `${hours} jam yang lalu`;
    } else if (minutes > 0) {
        return `${minutes} menit yang lalu`;
    } else {
        return 'Baru saja';
    }
}

function renderNotifications(notifications, isLoading = false) {
    const container = document.querySelector('.notifications-container');
    if (!container) return;

    if (isLoading) {
        container.innerHTML = `
            <div class="text-center p-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>`;
        return;
    }

    if (!notifications || notifications.length === 0) {
        container.innerHTML = `
            <div class="dropdown-item text-center py-3">
                <span class="text-gray-500">Tidak ada notifikasi</span>
            </div>`;
        return;
    }

    const notifHtml = notifications.map(notif => `
        <a class="dropdown-item d-flex align-items-center notification-item ${!notif.status_baca ? 'unread' : ''}" 
           href="#" 
           onclick="markNotificationAsRead(${notif.id_notifikasi}, this)"
           data-notif-id="${notif.id_notifikasi}">
            <div class="me-3">
                <div class="icon-circle ${getNotificationIconClass(notif.tipe_notifikasi)}">
                    <i class="${getNotificationIcon(notif.tipe_notifikasi)}"></i>
                </div>
            </div>
            <div class="flex-grow-1">
                <div class="small text-gray-500">${formatTimeAgo(notif.waktu_dibuat)}</div>
                <span class="${!notif.status_baca ? 'fw-bold' : ''}">${notif.pesan}</span>
            </div>
        </a>
    `).join('');

    container.innerHTML = notifHtml;
}

function getNotificationIcon(type) {
    switch (type) {
        case 'peringatan 1 tahun':
            return 'fas fa-clock';
        case 'peringatan 6 bulan':
            return 'fas fa-exclamation-triangle';
        case 'peringatan 3 bulan':
            return 'fas fa-exclamation-circle';
        case 'lelang otomatis':
            return 'fas fa-gavel';
        default:
            return 'fas fa-bell';
    }
}

function getNotificationIconClass(type) {
    switch (type) {
        case 'peringatan 1 tahun':
            return 'bg-info';
        case 'peringatan 6 bulan':
            return 'bg-warning';
        case 'peringatan 3 bulan':
            return 'bg-danger';
        case 'lelang otomatis':
            return 'bg-success';
        default:
            return 'bg-primary';
    }
}

async function markNotificationAsRead(notifId, element) {
    try {
        const response = await fetch(`/notifications/${notifId}/read`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            element.classList.remove('unread');
            element.querySelector('span').classList.remove('fw-bold');
            updateNotificationCount();
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsAsRead() {
    try {
        const response = await fetch('/notifications/mark-all-read', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const unreadItems = document.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
                item.querySelector('span').classList.remove('fw-bold');
            });
            updateNotificationBadge(0);
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

async function updateNotificationCount() {
    try {
        const response = await fetch('/notifications/count');
        const data = await response.json();
        updateNotificationBadge(data.count);
    } catch (error) {
        console.error('Error updating notification count:', error);
    }
}

async function fetchNotifications() {
    try {
        renderNotifications(null, true);
        const response = await fetch('/notifications');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const notifications = await response.json();
        console.log('Fetched notifications:', notifications);
        renderNotifications(notifications);
        const unreadCount = notifications.filter(n => !n.status_baca).length;
        updateNotificationBadge(unreadCount);

    } catch (error) {
        console.error('Error fetching notifications:', error);
        renderNotifications([]);
    }
}

function setupNotificationPolling() {
    setInterval(fetchNotifications, 30000);
}

function setupDropdownListener() {
    const dropdownToggle = document.querySelector('#alertsDropdown');
    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (e) => {
            e.preventDefault();
            fetchNotifications();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded, initializing notifications...');
    initializeNotifications();
});

function initializeNotifications() {
    console.log('Initializing notifications...');
    fetchNotifications();
    setupNotificationPolling();
    setupDropdownListener();
}