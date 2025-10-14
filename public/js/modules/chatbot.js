/**
 * card rendering, modal display, chat history
 */
class ChatbotManager {
    constructor() {
        this.currentUser = window.currentUser;
        this.userType = window.userType;
        this.carouselCounter = 0;
        this.texts = {
            greeting: 'Hi! Saya Helena 👋, Ada yang bisa saya bantu?',
            helpButton: 'Panduan',
            typing: 'Sedang mengetik...',
            error: 'Maaf, terjadi kesalahan.',
            serverError: 'Maaf, server tidak merespon.',
            clearConfirm: 'Yakin ingin menghapus semua percakapan?',
            helpCommand: 'bantuan'
        };
        this.init();
    }

    init() {
        this.cleanupOldChats();
        this.loadChatFromSession();
        this.bindEvents();
    }

    getChatKey() {
        return `chatbot_${this.userType}_${this.currentUser}_${Date.now()}`;
    }

    addInitialMessage() {
        const chat = document.getElementById('chatbotMessages');
        const initialMessage = `
            <div class="message-container bot">
                <div class="initial-message-wrapper">
                    <div class="initial-bot-bubble">${this.texts.greeting}</div>
                    <button class="btn help-button-compact" onclick="chatbot.triggerHelpIntent()">
                        <i class="fas fa-lightbulb me-1"></i> ${this.texts.helpButton}
                    </button>
                </div>
            </div>
        `;
        chat.innerHTML = initialMessage;
    }

    triggerHelpIntent() {
        const input = document.getElementById('chatbotInput');
        input.value = this.texts.helpCommand;
        document.getElementById('chatbotForm').dispatchEvent(new Event('submit'));
    }

    populateInput(query) {
        const input = document.getElementById('chatbotInput');
        input.value = query;
        input.focus();
    }

    renderQuickReplies(suggestions) {
        if (!suggestions || suggestions.length === 0) return '';

        const iconMap = {
            'location': { icon: 'fa-map-marker-alt', style: 'fas' },
            'price': { icon: 'fa-money-bill-wave', style: 'fas' },
            'quantity': { icon: 'fa-chart-bar', style: 'fas' },
            'owner': { icon: 'fa-user', style: 'far' },
            'status': { icon: 'fa-clipboard', style: 'far' },
            'guide': { icon: 'fa-lightbulb', style: 'fas' }
        };

        const chips = suggestions.map(s => {
            const iconData = iconMap[s.icon] || { icon: 'fa-question-circle', style: 'far' };
            return `<button class="quick-reply-chip" onclick="chatbot.populateInput('${s.query.replace(/'/g, "\\'")}')">
                <i class="${iconData.style} ${iconData.icon} me-1"></i> ${s.text}
            </button>`;
        }).join('');

        return `<div class="quick-replies">${chips}</div>`;
    }

    renderCards(data) {
        if (!data || !data.groups) return '';

        let html = '<div class="card-container">';

        data.groups.forEach((group, groupIndex) => {
            const itemCount = group.items.length;
            const visibleCount = 3;
            const uniqueId = `carousel-${this.carouselCounter++}-${groupIndex}`;

            html += `<div class="card-group">`;
            html += `<div class="card-group-header">${group.groupName}</div>`;

            if (itemCount > visibleCount) {
                html += `<div class="carousel-container">`;
                html += `<button class="carousel-arrow left" onclick="chatbot.scrollCarousel('${uniqueId}', -1)" id="prev-${uniqueId}">
                    <i class="fas fa-chevron-left"></i>
                 </button>`;
                html += `<div class="cards-wrapper" id="${uniqueId}">`;
            } else {
                html += `<div class="cards-wrapper">`;
            }

            group.items.forEach(item => {
                html += this.renderCard(item);
            });

            html += `</div>`;

            if (itemCount > visibleCount) {
                html += `<button class="carousel-arrow right" onclick="chatbot.scrollCarousel('${uniqueId}', 1)" id="next-${uniqueId}">
                    <i class="fas fa-chevron-right"></i>
                 </button>`;
                html += `</div>`;
            }

            html += `</div>`;
        });

        html += '</div>';
        return html;
    }

    renderRankingCards(data) {
        if (!data || !data.items) return '';

        const items = data.items;
        const itemCount = items.length;
        const visibleCount = 3;
        const uniqueId = `carousel-${this.carouselCounter++}-ranking`;

        let html = '<div class="card-container">';
        html += `<div class="card-group">`;

        if (itemCount > visibleCount) {
            html += `<div class="carousel-container">`;
            html += `<button class="carousel-arrow left" onclick="chatbot.scrollCarousel('${uniqueId}', -1)" id="prev-${uniqueId}">
                <i class="fas fa-chevron-left"></i>
             </button>`;
            html += `<div class="cards-wrapper" id="${uniqueId}">`;
        } else {
            html += `<div class="cards-wrapper">`;
        }

        items.forEach(item => {
            html += this.renderCard(item);
        });

        html += `</div>`;

        if (itemCount > visibleCount) {
            html += `<button class="carousel-arrow right" onclick="chatbot.scrollCarousel('${uniqueId}', 1)" id="next-${uniqueId}">
                <i class="fas fa-chevron-right"></i>
             </button>`;
            html += `</div>`;
        }

        html += `</div>`;
        html += '</div>';

        return html;
    }

    scrollCarousel(groupId, direction) {
        const wrapper = document.getElementById(groupId);
        const cardWidth = 170;
        const scrollAmount = cardWidth * 3;

        wrapper.scrollBy({
            left: direction * scrollAmount,
            behavior: 'smooth'
        });

        setTimeout(() => this.updateCarouselButtons(groupId), 300);
    }

    updateCarouselButtons(groupId) {
        const wrapper = document.getElementById(groupId);
        const prevBtn = document.getElementById('prev-' + groupId);
        const nextBtn = document.getElementById('next-' + groupId);

        if (!wrapper || !prevBtn || !nextBtn) return;

        const tolerance = 5;
        const isAtStart = wrapper.scrollLeft <= tolerance;
        const isAtEnd = wrapper.scrollLeft >= (wrapper.scrollWidth - wrapper.clientWidth - tolerance);

        prevBtn.disabled = isAtStart;
        nextBtn.disabled = isAtEnd;
    }

    renderCard(item) {
        const mainInfo = this.getMainInfo(item);

        return `
            <div class="item-card" onclick='chatbot.openModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
                <img src="${item.gambar}" alt="${item.nama_barang}" class="card-image"
                     onerror="this.src='/img/no-image.svg'">
                <div class="card-body">
                    <div class="card-title" title="${item.nama_barang}">${item.nama_barang}</div>
                    ${mainInfo}
                </div>
                <div class="card-footer">
                    <button class="view-detail-btn">
                        Lihat Detail <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    getMainInfo(item) {
        let html = '';
        const currentIntent = window.lastIntent || 'harga_barang';

        if (currentIntent === 'ranking') {
            if (item.harga_barang) {
                html += `<div class="card-info" style="font-size: 15px; font-weight: 700; color: #dc3545;">
                    <i class="fas fa-tag"></i> Rp ${item.harga_barang.toLocaleString()}
                </div>`;
            }
            if (item.jumlah) {
                html += `<div class="card-info" style="font-size: 13px; color: #666;">
                    <i class="fas fa-box"></i> ${item.jumlah} unit
                </div>`;
            }
            if (item.lokasi_barang) {
                html += `<div class="card-info" style="font-size: 11px; color: #666;">
                    <i class="fas fa-map-marker-alt"></i> ${item.lokasi_barang}
                </div>`;
            }
            return html;
        }

        const intentStyles = {
            'harga_barang': {
                primary: { field: 'harga_barang', prefix: 'Rp ', icon: 'fa-tag', color: '#007bff', size: '15px', weight: '700' },
                secondary: { field: 'lokasi_barang', icon: 'fa-map-marker-alt', color: '#666', size: '11px' }
            },
            'lokasi_barang': {
                primary: { field: 'lokasi_barang', icon: 'fa-map-marker-alt', color: '#28a745', size: '14px', weight: '700' },
                secondary: { field: 'status_barang', icon: 'fa-info-circle', color: '#666', size: '11px' }
            },
            'kepemilikan_barang': {
                primary: { field: 'pemilik', icon: 'fa-user', color: '#6f42c1', size: '13px', weight: '700' },
                secondary: { field: 'jabatan', color: '#666', size: '11px' }
            },
            'status_barang': {
                primary: { field: 'status_barang', icon: 'fa-clipboard', color: '#17a2b8', size: '14px', weight: '700' },
                secondary: { field: 'kondisi_barang', prefix: 'Kondisi: ', color: '#666', size: '11px' }
            },
            'jumlah_barang': {
                primary: { field: 'jumlah', suffix: ' unit', icon: 'fa-box', color: '#fd7e14', size: '15px', weight: '700' },
                secondary: { field: 'lokasi_barang', icon: 'fa-map-marker-alt', color: '#666', size: '11px' }
            }
        };

        const style = intentStyles[currentIntent];
        if (style) {
            if (style.primary && item[style.primary.field]) {
                const value = style.primary.field === 'harga_barang' ? 
                    item[style.primary.field].toLocaleString() : 
                    item[style.primary.field];
                html += `<div class="card-info" style="font-size: ${style.primary.size}; ${style.primary.weight ? `font-weight: ${style.primary.weight};` : ''} color: ${style.primary.color};">
                    ${style.primary.icon ? `<i class="fas ${style.primary.icon}"></i> ` : ''}${style.primary.prefix || ''}${value}${style.primary.suffix || ''}
                </div>`;
            }
            if (style.secondary && item[style.secondary.field]) {
                html += `<div class="card-info" style="font-size: ${style.secondary.size}; color: ${style.secondary.color};">
                    ${style.secondary.icon ? `<i class="fas ${style.secondary.icon}"></i> ` : ''}${style.secondary.prefix || ''}${item[style.secondary.field]}
                </div>`;
            }
        } else {
            if (item.harga_barang) {
                html += `<div class="card-info"><i class="fas fa-tag"></i> Rp ${item.harga_barang.toLocaleString()}</div>`;
            }
            if (item.lokasi_barang) {
                html += `<div class="card-info"><i class="fas fa-map-marker-alt"></i> ${item.lokasi_barang}</div>`;
            }
        }

        return html;
    }

    openModal(item) {
        const modal = document.createElement('div');
        modal.className = 'detail-modal';
        modal.id = 'detailModal';

        const isAdmin = this.userType === 'admin';
        const editButton = isAdmin ?
            `<button class="btn-modal btn-modal-primary" onclick="window.location.href='/barang?id=${item.id_barang}&action=edit'">
                <i class="fas fa-edit"></i> Edit Data Barang
            </button>` : '';

        const modalFields = [
            { key: 'harga_barang', label: 'Harga', format: (val) => `Rp ${val.toLocaleString()}` },
            { key: 'lokasi_barang', label: 'Lokasi' },
            { key: 'status_barang', label: 'Status' },
            { key: 'kondisi_barang', label: 'Kondisi' },
            { key: 'pemilik', label: 'Pemilik', format: (val, item) => `${val}${item.jabatan ? ` (${item.jabatan})` : ''}` },
            { key: 'jumlah', label: 'Jumlah', format: (val) => `${val} unit` }
        ];

        let fieldsHtml = '';
        modalFields.forEach(field => {
            if (item[field.key]) {
                const value = field.format ? field.format(item[field.key], item) : item[field.key];
                fieldsHtml += `
                    <div class="modal-info-group">
                        <div class="modal-info-label">${field.label}</div>
                        <div class="modal-info-value">${value}</div>
                    </div>`;
            }
        });

        modal.innerHTML = `
            <div class="modal-content-custom">
                <div class="modal-header-custom">
                    <h5>${item.nama_barang}</h5>
                    <button class="close-modal" onclick="chatbot.closeModal()">&times;</button>
                </div>
                <div class="modal-body-custom">
                    <img src="${item.gambar}" alt="${item.nama_barang}" class="modal-image" 
                         onerror="this.src='/img/no-image.svg'">
                    ${fieldsHtml}
                </div>
                <div class="modal-footer-custom">
                    <button class="btn-modal btn-modal-secondary" onclick="chatbot.closeModal()">Tutup</button>
                    ${editButton}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });
    }

    closeModal() {
        const modal = document.getElementById('detailModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 200);
        }
    }

    saveChatToSession() {
        try {
            const chatMessages = document.getElementById('chatbotMessages').innerHTML;
            const chatKey = `chatbot_${this.userType}_${this.currentUser}`;

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = chatMessages;
            const allMessages = tempDiv.querySelectorAll('.message-container');

            if (allMessages.length > 1000) {
                const keepMessages = Array.from(allMessages).slice(-1000);
                tempDiv.innerHTML = keepMessages.map(m => m.outerHTML).join('');
            }

            localStorage.setItem('current_chat_key', chatKey);
            localStorage.setItem(chatKey, tempDiv.innerHTML);
        } catch (e) {
            console.warn('Storage penuh, clearing old chats...');
            this.cleanupStorage();
        }
    }

    cleanupStorage() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('chatbot_') && !key.includes(this.currentUser)) {
                localStorage.removeItem(key);
            }
        });

        try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = document.getElementById('chatbotMessages').innerHTML;
            const allMessages = tempDiv.querySelectorAll('.message-container');
            const keepMessages = Array.from(allMessages).slice(-750);
            tempDiv.innerHTML = keepMessages.map(m => m.outerHTML).join('');

            const chatKey = `chatbot_${this.userType}_${this.currentUser}`;
            localStorage.setItem('current_chat_key', chatKey);
            localStorage.setItem(chatKey, tempDiv.innerHTML);
        } catch (e2) {
            console.error('chat tidak tersimpan');
        }
    }

    clearChat() {
        if (confirm(this.texts.clearConfirm)) {
            this.addInitialMessage();

            const chatKey = `chatbot_${this.userType}_${this.currentUser}`;
            localStorage.removeItem(chatKey);
            localStorage.removeItem('current_chat_key');

            this.carouselCounter = 0;
            this.saveChatToSession();
        }
    }

    loadChatFromSession() {
        const currentChatKey = localStorage.getItem('current_chat_key');
        if (currentChatKey && currentChatKey.includes(this.currentUser)) {
            const savedMessages = localStorage.getItem(currentChatKey);
            if (savedMessages) {
                document.getElementById('chatbotMessages').innerHTML = savedMessages;
                document.getElementById('chatbotMessages').scrollTop = document.getElementById('chatbotMessages').scrollHeight;
            } else {
                this.addInitialMessage();
            }
        } else {
            this.addInitialMessage();
        }
    }

    cleanupOldChats() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('chatbot_') && !key.includes(this.currentUser) && key !== 'current_chat_key') {
                localStorage.removeItem(key);
            }
        });
    }

    scrollToLastUserMessage(lastUserMessage) {
        setTimeout(() => {
            if (lastUserMessage) {
                lastUserMessage.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                const chat = document.getElementById('chatbotMessages');
                chat.scrollTop = chat.scrollTop + 375;
            } else {
                document.getElementById('chatbotMessages').scrollTop = document.getElementById('chatbotMessages').scrollHeight;
            }
        }, 100);
    }

    async handleChatSubmit(e) {
        e.preventDefault();
        const input = document.getElementById('chatbotInput');
        const msg = input.value.trim();
        if (!msg) return;

        const chat = document.getElementById('chatbotMessages');

        chat.innerHTML += `<div class="message-container user"><div class="message-bubble user-message">${msg}</div></div>`;
        const userMessages = chat.querySelectorAll('.message-container.user');
        const lastUserMessage = userMessages[userMessages.length - 1];
        chat.scrollTop = chat.scrollHeight;
        this.saveChatToSession();
        input.value = '';

        chat.innerHTML += `<div class="message-container bot" id="loading-bot"><div class="message-bubble bot-message">${this.texts.typing}</div></div>`;
        chat.scrollTop = chat.scrollHeight;
        this.saveChatToSession();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });
            const data = await response.json();

            if (data.intent) {
                window.lastIntent = data.intent;
            }

            const loading = document.getElementById('loading-bot');
            if (loading) loading.remove();

            if (data && data.response) {
                this.processResponse(data, chat);
                this.scrollToLastUserMessage(lastUserMessage);
                this.saveChatToSession();
            } else {
                chat.innerHTML += `<div class="message-container bot"><div class="message-bubble bot-message" style="background: #dc3545; color: white;">${this.texts.error}</div></div>`;
            }
        } catch (err) {
            const loading = document.getElementById('loading-bot');
            if (loading) loading.remove();

            chat.innerHTML += `<div class="message-container bot"><div class="message-bubble bot-message" style="background: #dc3545; color: white;">${this.texts.serverError}</div></div>`;
            chat.scrollTop = chat.scrollHeight;
        }
    }

    processResponse(data, chat) {
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container bot';

        const hasGroupedData = data.data && data.data.groups && data.data.groups.length > 0 && 
                              data.data.groups.some(g => g.items && g.items.length > 0);
        const hasRankingData = data.data && data.data.type === 'ranking' && 
                              data.data.items && data.data.items.length > 0;

        let messageContent = '';

        if (hasGroupedData || hasRankingData) {
            messageContent = '<div class="message-with-cards">';
            messageContent += `<div class="message-text-above">${data.response}</div>`;

            if (hasGroupedData) {
                messageContent += this.renderCards(data.data);
            } else if (hasRankingData) {
                messageContent += this.renderRankingCards(data.data);
            }

            messageContent += '</div>';
        } else {
            const hasImages = data.response.includes('<img') || data.response.includes('<strong>') || data.response.includes('<br>');
            const formattedResponse = hasImages ? data.response : data.response.replace(/\n/g, '<br>');

            messageContent += '<div class="message-bubble bot-message">';
            messageContent += formattedResponse;
            messageContent += '</div>';
        }

        messageContainer.innerHTML = messageContent;
        chat.appendChild(messageContainer);

        this.updateCarouselButtonsAfterRender(data);
        this.addQuickReplies(data, chat);
        this.addActionButtons(data, chat);
    }

    updateCarouselButtonsAfterRender(data) {
        if (data.data) {
            if (data.data.groups) {
                data.data.groups.forEach((group, idx) => {
                    if (group.items.length > 3) {
                        const uniqueId = `carousel-${this.carouselCounter - data.data.groups.length + idx}-${idx}`;
                        this.updateCarouselButtons(uniqueId);
                    }
                });
            } else if (data.data.type === 'ranking' && data.data.items && data.data.items.length > 3) {
                const uniqueId = `carousel-${this.carouselCounter - 1}-ranking`;
                this.updateCarouselButtons(uniqueId);
            }
        }
    }

    addQuickReplies(data, chat) {
        const isNotFoundMessage = data.response.toLowerCase().includes('tidak ditemukan');

        if (data.suggestions && data.suggestions.length > 0 && !isNotFoundMessage) {
            const quickReplyContainer = document.createElement('div');
            quickReplyContainer.className = 'message-container bot';
            quickReplyContainer.style.marginTop = '0';
            quickReplyContainer.innerHTML = this.renderQuickReplies(data.suggestions);
            chat.appendChild(quickReplyContainer);
        }
    }

    addActionButtons(data, chat) {
        if (data.actionButtons && data.actionButtons.length > 0) {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'message-container bot';
            buttonContainer.style.marginTop = '5px';

            let buttonsHTML = '';
            data.actionButtons.forEach(btn => {
                buttonsHTML += `<a href="${btn.url}" class="action-button">${btn.text}</a>`;
            });

            buttonContainer.innerHTML = `<div class="action-buttons">${buttonsHTML}</div>`;
            chat.appendChild(buttonContainer);
        }
    }

    bindEvents() {
        document.getElementById('chatbotForm').addEventListener('submit', (e) => this.handleChatSubmit(e));
    }

    clearChatOnLogout() {
        const chatKey = `chatbot_${this.userType}_${this.currentUser}`;
        localStorage.removeItem(chatKey);
        localStorage.removeItem('current_chat_key');
    }
}

let chatbot;

window.addEventListener('DOMContentLoaded', () => {
    chatbot = new ChatbotManager();
});

function clearChat() {
    chatbot.clearChat();
}