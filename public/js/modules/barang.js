if (window.location.pathname === "/barang") {

    toastr.options = {
        closeButton: true,
        progressBar: true,
        positionClass: "toast-top-right",
        timeOut: 1000,
        preventDuplicates: true
    };

    $(document).ready(function () {
        $('#addBarangForm').submit(function (event) {
            event.preventDefault();
            var formData = new FormData(this);

            $.ajax({
                url: '/barang',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (response) {
                    if (response.success) {
                        toastr.success('Barang berhasil ditambahkan!', 'Sukses');
                        $('#addBarangForm')[0].reset();
                        setTimeout(function () {
                            location.reload();
                        }, 2000);
                    } else {
                        toastr.error('Gagal menambahkan barang: ' + response.message);
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Error:', error);
                    toastr.error('Terjadi kesalahan: ' + error);
                }
            });
        });
    });

    new Cleave('.input-harga', {
        numeral: true,
        numeralThousandsGroupStyle: 'thousand',
        prefix: 'Rp ',
        noImmediatePrefix: true
    });
    document.querySelector('form').addEventListener('submit', function (event) {
        const inputHarga = document.querySelector('.input-harga');
        const hargaValue = inputHarga.value;

        const cleanValue = hargaValue.replace(/[^0-9]/g, '');

        inputHarga.value = cleanValue;
    });
    function confirmDelete(idBarang) {
        Swal.fire({
            title: 'Hapus Barang?',
            text: "Data barang dihapus permanen",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: '/barang/delete/' + idBarang,
                    type: 'GET',
                    success: function (response) {
                        if (response.success) {
                            Swal.fire(
                                'Terhapus!',
                                'Barang berhasil dihapus.',
                                'success'
                            ).then(() => {
                                location.reload();
                            });
                        } else {
                            Swal.fire(
                                'Gagal!',
                                response.message || 'Terjadi kesalahan saat menghapus.',
                                'error'
                            );
                        }
                    }
                });
            }
        });
    }
    const CONFIG = {
        MAX_IMAGE_SIZE: 10 * 1024 * 1024,
        DEFAULT_IMAGE_PATH: '/path/to/default-image.jpg',
        LOADING_IMAGE_PATH: '/path/to/loading.gif',
        API_ENDPOINTS: {
            DETAIL: (id) => `/barang/detail/${id}`,
            EDIT: '/barang/edit',
            UPDATE: '/update-barang'
        }
    };

    const Utils = {
        formatDateTimeLocal(dateString) {
            if (!dateString) return '';
            return new Date(dateString).toISOString().slice(0, 16);
        },

        formatDate(date) {
            return new Intl.DateTimeFormat('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(date));
        },

        showError(message) {
            toastr.error(message);
            console.error('Error:', message);
        },

        validateImageFile(file) {
            if (!file) return true;

            if (file.size > CONFIG.MAX_IMAGE_SIZE) {
                this.showError('Ukuran gambar terlalu besar. Maksimal 10MB');
                return false;
            }

            if (!file.type.match('image.*')) {
                this.showError('File harus berupa gambar');
                return false;
            }

            return true;
        }
    };

    class ImageHandler {
        constructor(previewElement, inputElement) {
            this.preview = $(previewElement);
            this.input = $(inputElement);
            this.setupEventListeners();
        }

        setupEventListeners() {
            this.input.on('change', (e) => this.handleImageChange(e));

            $('.image-upload-container')
                .on('click', () => this.input.click())
                .on('mouseenter', () => $('.image-upload-overlay').css('opacity', '1'))
                .on('mouseleave', () => $('.image-upload-overlay').css('opacity', '0'));
        }

        handleImageChange(event) {
            const file = event.target.files[0];
            if (!file) return;

            if (!Utils.validateImageFile(file)) {
                event.target.value = '';
                return;
            }

            this.showLoadingState();
            this.readAndPreviewImage(file);
        }

        showLoadingState() {
            this.preview.attr('src', CONFIG.LOADING_IMAGE_PATH);
        }

        readAndPreviewImage(file) {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.preview
                        .attr('src', e.target.result)
                        .addClass('preview-image');
                };
                img.src = e.target.result;
            };

            reader.onerror = () => {
                Utils.showError('Gagal membaca file gambar');
                this.preview
                    .attr('src', CONFIG.DEFAULT_IMAGE_PATH)
                    .addClass('preview-image');
            };

            reader.readAsDataURL(file);
        }

        setPreviewImage(imagePath) {
            if (!imagePath) {
                this.preview.attr('src', '/img/no-image.svg');
                return;
            }

            // Langsung set path, bukan base64
            this.preview.attr('src', imagePath).addClass('preview-image');
        }
    }

    class BarangFormHandler {
        constructor() {
            this.form = $('#editBarangForm');
            this.imageHandler = new ImageHandler('#previewImage', '#gambar_barang');
            this.setupFormElements();
            this.setupEventListeners();
        }

        setupFormElements() {
            this.hargaInput = new Cleave('#harga_barang', {
                numeral: true,
                numeralThousandsGroupStyle: 'thousand',
                prefix: 'Rp ',
                numeralDecimalScale: 0
            });

            this.statusSelect = $('#status_barang');
            this.lelangSection = $('#lelangSection');
        }

        setupEventListeners() {
            this.statusSelect.on('change', () => this.handleStatusChange());
            this.form.on('submit', (e) => this.handleSubmit(e));
        }

        handleStatusChange() {
            const isLelang = this.statusSelect.val() === 'lelang';
            this.lelangSection.toggleClass('d-none', !isLelang);

            if (!isLelang) {
                $('#waktu_mulai, #waktu_selesai').val('');
            }
        }

        async handleSubmit(e) {
            e.preventDefault();

            try {
                const formData = new FormData(this.form[0]);

                const hargaValue = this.hargaInput.getRawValue();
                formData.set('harga_barang', hargaValue);

                if (!formData.get('nama_barang')) {
                    throw new Error('Nama barang harus diisi');
                }

                const gambarFile = $('#gambar_barang')[0].files[0];
                if (gambarFile && !Utils.validateImageFile(gambarFile)) {
                    return;
                }

                const response = await $.ajax({
                    url: CONFIG.API_ENDPOINTS.EDIT,
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false
                });

                if (response.success) {
                    toastr.success('Barang berhasil diperbarui!');
                    $('#editBarangModal').modal('hide');

                    // Refresh the table
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                } else {
                    throw new Error(response.message || 'Gagal memperbarui barang');
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                toastr.error(error.message || 'Terjadi kesalahan saat memperbarui barang');
            }
        }

        populateForm(barang) {
            this.form[0].reset();

            $('#editBarangModalLabel').text(`Edit Detail Barang - ${barang.nama_barang}`);
            $('#id_barang').val(barang.id_barang);
            $('#nama_barang').val(barang.nama_barang);
            $('#deskripsi_barang').val(barang.deskripsi_barang);
            $('#kategori').val(barang.kategori);
            $('#lokasi_barang').val(barang.lokasi_barang);
            $('#status_barang').val(barang.status_barang);
            $('#id_karyawan').val(barang.id_karyawan);
            $('#kondisi_barang').val(barang.kondisi_barang);

            this.hargaInput.setRawValue(barang.harga_barang);

            if (barang.tanggal_perolehan) {
                $('#tanggal_perolehan').val(Utils.formatDate(barang.tanggal_perolehan));
            }

            this.handleLelangSection(barang);

            this.imageHandler.setPreviewImage(barang.gambar_barang);
        }

        handleLelangSection(barang) {
            const isLelang = barang.status_barang === 'lelang';
            this.lelangSection.toggleClass('d-none', !isLelang);

            if (isLelang) {
                $('#waktu_mulai').val(Utils.formatDateTimeLocal(barang.waktu_mulai));
                $('#waktu_selesai').val(Utils.formatDateTimeLocal(barang.waktu_selesai));
            }
        }
    }

    const formHandler = new BarangFormHandler();

    function setupCleave() {
        // Cleave is already initialized in BarangFormHandler
        // This function is kept for backward compatibility
    }

    const role = "<%= role %>";
    if (role === 'atasan') {
        document.querySelectorAll('.btn-edit, .btn-delete').forEach(el => el.remove());
    }

    function getBarangDetail(id_barang) {
        $.ajax({
            url: `/barang/detail/${id_barang}`,
            type: 'GET',
            success: function (response) {
                if (response.success) {
                    $('#editBarangForm')[0].reset();

                    const barang = response.data;
                    $('#id_barang').val(barang.id_barang);
                    $('#nama_barang').val(barang.nama_barang);
                    $('#deskripsi_barang').val(barang.deskripsi_barang);
                    $('#kategori').val(barang.kategori);
                    $('#lokasi_barang').val(barang.lokasi_barang);
                    $('#harga_barang').val(barang.harga_barang);
                    $('#status_barang').val(barang.status_barang);
                    $('#pemilikBarang').val(barang.id_karyawan);
                    $('#kondisi_barang').val(barang.kondisi_barang);

                    $('#id_display').text(barang.id_barang);
                    $('#nama_display').text(barang.nama_barang);

                    if (barang.status_barang === 'proses') {
                        window.location.href = `/lelang`;
                    }

                    if (barang.waktu_masuk) {
                        $('#waktu_masuk').text(new Date(barang.waktu_masuk).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }));
                    }

                    if (barang.gambar_barang) {
                        $('#previewImage').attr('src', barang.gambar_barang);
                    } else {
                        $('#previewImage').attr('src', '/img/no-image.svg');
                    }
                    setupCleave();

                    $('#editBarangModal').modal('show');
                } else {
                    toastr.error('Gagal mengambil data barang: ' + response.message);
                }
            },
            error: function (xhr, status, error) {
                console.error('Error:', error);
                console.error('Status:', status);
                console.error('Response:', xhr.responseText);
                toastr.error('Terjadi kesalahan saat mengambil data barang');
            }
        });
    }

    function formatTimeRemaining(startTime, endTime) {
        if (!startTime || !endTime) return '-';

        const now = new Date();
        const end = new Date(endTime);

        if (now >= end) return 'Selesai';

        const diff = end - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${days}h${hours}j${minutes}m${seconds}d`;
    }

    function getStatusClass(status) {
        switch (status) {
            case 'tersedia': return 'bg-success';
            case 'lelang': return 'bg-warning';
            case 'jual': return 'bg-danger';
            case 'proses': return 'bg-primary';
            case 'diproses atasan': return 'bg-primary';
            case 'ditolak atasan': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }

    function getStatusText(status) {
        switch (status) {
            case 'tersedia': return 'Tersedia';
            case 'lelang': return 'Menunggu';
            case 'jual': return 'Jual';
            case 'proses': return 'Sedang Lelang';
            case 'diproses atasan': return 'Diproses Atasan';
            case 'ditolak atasan': return 'Ditolak Atasan';
            default: return 'Tidak Diketahui';
        }
    }

    function updateTableRow(item) {
        const row = document.querySelector(`tr[data-id="${item.id_barang}"]`);
        if (!row) return;

        const statusClass = getStatusClass(item.status_barang);
        const statusText = getStatusText(item.status_barang);

        row.innerHTML = `
            <td class="px-4 py-3 text-center">${item.id_barang}</td>
            <td class="px-4 py-3 text-sm font-medium">${item.nama_barang}</td>
            <td class="px-4 py-3 text-sm">${item.kategori}</td>
            <td class="px-4 py-3 text-sm">${item.lokasi_barang}</td>
            <td class="px-4 py-3 text-sm">${item.nama_karyawan || '-'}</td>
            <td class="px-4 py-3 text-sm text-center" 
                id="timer-${item.id_barang}"
                data-start-time="${item.waktu_mulai || ''}"
                data-end-time="${item.waktu_selesai || ''}">
                ${formatTimeRemaining(item.waktu_mulai, item.waktu_selesai)}
            </td>
            <td class="px-4 py-3 text-center">
                <span class="badge ${statusClass} text-white px-3 py-1 rounded-pill">
                    ${statusText}
                </span>
            </td>
            <td class="px-4 py-3 text-center">
                <div class="btn-group" role="group">
                    <button class="btn btn-white btn-sm" 
                        data-bs-toggle="modal"
                        data-bs-target="#editBarangModal"
                        title="Edit"
                        onclick="getBarangDetail('${item.id_barang}')">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <button class="btn btn-danger btn-sm"
                        data-bs-toggle="popup"
                        title="Hapus"
                        onclick="confirmDelete('${item.id_barang}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
    }

    function updateTable() {
        const urlParams = new URLSearchParams(window.location.search);
        const currentPage = urlParams.get('page') || 1;
        const sort = urlParams.get('sort') || '';
        const order = urlParams.get('order') || '';
        const limit = urlParams.get('limit') || '';
        const search = urlParams.get('search') || '';

        const tableBody = document.querySelector('tbody');
        if (tableBody) {
            tableBody.style.opacity = '0.5';
        }

        $.ajax({
            url: '/barang/refresh',
            type: 'GET',
            data: {
                page: currentPage,
                sort: sort,
                order: order,
                limit: limit,
                search: search
            },
            success: function (response) {
                if (response.success) {
                    if (tableBody) {
                        tableBody.innerHTML = '';
                        response.barang.forEach(item => {
                            tableBody.innerHTML += generateTableRow(item);
                        });
                        tableBody.style.opacity = '1';
                    }
                    initializeTimers();
                    updateSortingIndicators(sort, order);
                    if (res.pagination) {
                        updatePagination(res.pagination);
                    }
                }
            },
            error: function (xhr, status, error) {
                console.error('Error:', error);
                toastr.error('Gagal memperbarui tabel');
                if (tableBody) {
                    tableBody.style.opacity = '1';
                }
            }
        });
    }

    function generateTableRow(item) {
        const statusClass = getStatusClass(item.status_barang);
        const statusText = getStatusText(item.status_barang);

        let opsiButton = '';
        if (window.role !== 'atasan') {
            opsiButton = `
                <div class="btn-group" role="group">
                    <button class="btn btn-white btn-sm" 
                        onclick="getBarangDetail('${item.id_barang}')"
                        title="Edit">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <button class="btn btn-danger btn-sm"
                        onclick="confirmDelete('${item.id_barang}')"
                        title="Hapus">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        } else {
            opsiButton = `
                <button class="btn btn-info btn-sm detail-barang-btn" 
                    data-id="${item.id_barang}" 
                    title="Lihat Detail">
                    <i class="fas fa-eye"></i> Detail
                </button>
            `;
        }

        return `
            <tr data-id="${item.id_barang}">
                <td class="px-4 py-3 text-center">${item.id_barang}</td>
                <td class="px-4 py-3 text-sm font-medium">${item.nama_barang}</td>
                <td class="px-4 py-3 text-sm">${item.kategori}</td>
                <td class="px-4 py-3 text-sm">${item.lokasi_barang}</td>
                <td class="px-4 py-3 text-sm">${item.nama_karyawan || '-'}</td>
                <td class="px-4 py-3 text-sm text-center" 
                    id="timer-${item.id_barang}"
                    data-start-time="${item.waktu_mulai || ''}"
                    data-end-time="${item.waktu_selesai || ''}">
                    ${formatTimeRemaining(item.waktu_mulai, item.waktu_selesai)}
                </td>
                <td class="px-4 py-3 text-center">
                    <span class="badge ${statusClass} text-white px-3 py-1 rounded-pill">
                        ${statusText}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    ${opsiButton}
                </td>
            </tr>
        `;
    }

    document.addEventListener('DOMContentLoaded', function () {
        function initializeSorting() {
            const tableHeaders = document.querySelectorAll('th.sortable');

            tableHeaders.forEach(header => {
                header.removeEventListener('click', handleHeaderClick);
                header.addEventListener('click', handleHeaderClick);
                header.style.cursor = 'pointer';
            });
        }

        function handleHeaderClick(event) {
            const header = event.currentTarget;
            const field = header.dataset.field;
            const currentSort = header.dataset.currentSort;
            const currentOrder = header.dataset.currentOrder;

            let newOrder = 'ASC';
            if (field === currentSort && currentOrder === 'ASC') {
                newOrder = 'DESC';
            }

            const urlParams = new URLSearchParams(window.location.search);
            urlParams.set('sort', field);
            urlParams.set('order', newOrder);
            urlParams.set('page', '1');

            const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
            history.pushState({}, '', newUrl);

            updateSortingIndicators(field, newOrder);

            updateTable();
        }

        function updateSortingIndicators(sortField, sortOrder) {
            const headers = document.querySelectorAll('th.sortable');

            headers.forEach(header => {
                const field = header.dataset.field;
                const iconElement = header.querySelector('i.fas');

                iconElement?.classList.remove('fa-sort', 'fa-sort-up', 'fa-sort-down');

                if (field === sortField) {
                    iconElement?.classList.add(sortOrder === 'ASC' ? 'fa-sort-up' : 'fa-sort-down');
                    header.dataset.currentSort = sortField;
                    header.dataset.currentOrder = sortOrder;
                } else {
                    iconElement?.classList.add('fa-sort');
                }
            });
        }
        initializeSorting();

        document.addEventListener('tableUpdated', function () {
            initializeSorting();
        });

        const originalUpdateTable = window.updateTable;
        window.updateTable = function () {
            originalUpdateTable.call(this, ...arguments);
            document.dispatchEvent(new CustomEvent('tableUpdated'));
        };
    });

    function updatePagination(paginationData) {
        if (!paginationData) return;
        const containers = document.querySelectorAll('.pagination');
        if (!containers || containers.length === 0) return;

        const currentPage = parseInt(paginationData.currentPage) || 1;
        const totalPages = Math.max(1, parseInt(paginationData.totalPages) || 1);
        const delta = 2; // range kiri/kanan current page

        // build compact range with ellipsis
        const range = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }
        const rangeWithDots = [];
        let last = null;
        for (const i of range) {
            if (last !== null) {
                if (i - last === 2) rangeWithDots.push(last + 1);
                else if (i - last > 2) rangeWithDots.push('...');
            }
            rangeWithDots.push(i);
            last = i;
        }

        containers.forEach(paginationContainer => {
            // build HTML
            let html = '';

            html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
                 </li>`;

            for (const p of rangeWithDots) {
                if (p === '...') {
                    html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                } else {
                    html += `<li class="page-item ${p === currentPage ? 'active' : ''}">
                            <a class="page-link" href="#" data-page="${p}">${p}</a>
                         </li>`;
                }
            }

            html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
                 </li>`;

            // replace markup
            paginationContainer.innerHTML = html;

            // remove any previous onclick handlers to avoid duplicates, then attach one delegated handler
            paginationContainer.onclick = function (e) {
                const a = e.target.closest('a.page-link');
                if (!a) return;
                e.preventDefault();

                const page = parseInt(a.dataset.page);
                if (isNaN(page) || page < 1 || page > totalPages) return;

                // visual feedback: update active immediately
                paginationContainer.querySelectorAll('.page-item').forEach(li => li.classList.remove('active'));
                const parentLi = a.closest('.page-item');
                if (parentLi) parentLi.classList.add('active');

                // update URL and reload table
                const urlParams = new URLSearchParams(window.location.search);
                urlParams.set('page', page);
                history.pushState({}, '', `${window.location.pathname}?${urlParams.toString()}`);

                // call table refresh (your existing function)
                if (typeof updateTable === 'function') {
                    updateTable();
                } else {
                    // fallback: force a reload if updateTable not present
                    window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
                }
            };
        });
    }


    $('#editBarangForm').on('submit', function (e) {
        e.preventDefault();

        const formData = new FormData(this);
        const hargaValue = $('#harga_barang').val().replace(/[^0-9]/g, '');
        formData.set('harga_barang', hargaValue);

        const submitBtn = $(this).find('button[type="submit"]');
        submitBtn.prop('disabled', true).html('Menyimpan...');

        $.ajax({
            url: '/barang/edit',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                if (response.success) {
                    toastr.success('Barang berhasil diperbarui!', 'Sukses');
                    $('#editBarangModal').modal('hide');
                    setTimeout(function () {
                        updateTable();
                    }, 2000);
                } else {
                    toastr.error('Gagal memperbarui barang: ' + response.message);
                }
            },
            error: function (xhr, status, error) {
                console.error('Error:', error);
                console.error('Response:', xhr.responseText);
                toastr.error('Terjadi kesalahan saat memperbarui data');
            },
            complete: function () {
                submitBtn.prop('disabled', false).html('Simpan');
            }
        });
    });

    let timerInterval;

    function initializeTimers() {
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        const updateAllTimers = () => {
            const timerElements = document.querySelectorAll('[id^="timer-"]');
            timerElements.forEach(timerEl => {
                const id_barang = timerEl.id.split('-')[1];
                const startTimeStr = timerEl.getAttribute('data-start-time');
                const endTimeStr = timerEl.getAttribute('data-end-time');
                const status = $(`tr[data-id="${id_barang}"] .badge`).text().trim();

                if (startTimeStr && endTimeStr && status === 'Sedang Lelang') {
                    timerEl.textContent = formatTimeRemaining(startTimeStr, endTimeStr);
                } else {
                    timerEl.textContent = '-';
                }
            });
        };

        timerInterval = setInterval(updateAllTimers, 1000);
        updateAllTimers();
    }

    $(document).ready(function () {
        updateTable();
        initializeTimers();
    });

    document.addEventListener('DOMContentLoaded', function () {
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
            printBtn.addEventListener('click', function () {
                printBtn.disabled = true;
                printBtn.textContent = 'Mengunduh...';

                fetch('laporan/print')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.blob();
                    })
                    .then(blob => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = 'INVENTAS_BARANG.xlsx';
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        alert('Gagal mengunduh file Excel');
                    })
                    .finally(() => {
                        printBtn.disabled = false;
                        printBtn.textContent = 'Unduh Excel';
                    });
            });
        }
    });

    function changeEntries(value) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('limit', value);
        urlParams.set('page', '1');

        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.location.href = newUrl;
    }


    function sortTable(field, order) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('sort', field);
        urlParams.set('order', order);
        urlParams.set('page', '1');

        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.location.href = newUrl;
    }

    function sortByDate(order) {
        sortTable('waktu_masuk', order);
    }

    // Handler untuk tombol detail (khusus atasan)
    $(document).on('click', '.detail-barang-btn', function () {
        const idBarang = $(this).data('id');
        $.get(`/barang/detail/${idBarang}`, function (data) {
            if (data.success && data.data) {
                const b = data.data;
                $('#detailBarangModalLabel').text('Detail Barang #' + b.id_barang);
                $('#detailNamaBarang').text(b.nama_barang || '-');
                $('#detailKategori').text(b.kategori || '-');
                $('#detailLokasi').text(b.lokasi_barang || '-');
                $('#detailPemilik').text(b.nama_karyawan || '-');
                $('#detailStatus').text(b.status_barang || '-');

                // Jika ingin hapus masa lelang karena tidak relevan:
                $('#detailMasaLelang').text('-');

                $('#detailHarga').text(
                    b.harga_barang
                        ? b.harga_barang.toLocaleString('id-ID', {
                            style: 'currency',
                            currency: 'IDR'
                        })
                        : '-'
                );

                $('#detailBarangModal').modal('show');
            } else {
                toastr.error('Gagal mengambil detail barang');
            }
        });
    });

    // $(document).on('click', '.detail-barang-btn', function() {
    //     const idBarang = $(this).data('id');
    //     $.get(`/barang/detail/${idBarang}`, function(data) {
    //         if (data.success && data.barang) {
    //             const b = data.barang;
    //             $('#detailBarangModalLabel').text('Detail Barang #' + b.id_barang);
    //             $('#detailNamaBarang').text(b.nama_barang || '-');
    //             $('#detailKategori').text(b.kategori || '-');
    //             $('#detailLokasi').text(b.lokasi_barang || '-');
    //             $('#detailPemilik').text(b.nama_karyawan || '-');
    //             $('#detailStatus').text(b.status_barang || '-');
    //             let masaLelang = '-';
    //             if (b.waktu_mulai && b.waktu_selesai) {
    //                 const mulai = new Date(b.waktu_mulai);
    //                 const selesai = new Date(b.waktu_selesai);
    //                 masaLelang = mulai.toLocaleString('id-ID') + ' s/d ' + selesai.toLocaleString('id-ID');
    //             }
    //             $('#detailMasaLelang').text(masaLelang);
    //             $('#detailHarga').text(b.harga_barang ? b.harga_barang.toLocaleString('id-ID', {style: 'currency', currency: 'IDR'}) : '-');
    //             $('#detailBarangModal').modal('show');
    //         } else {
    //             toastr.error('Gagal mengambil detail barang');
    //         }
    //     });
    // });

    function showDetailBarang(id_barang) {
        $.ajax({
            url: `/barang/detail/${id_barang}`,
            type: 'GET',
            success: function (response) {
                console.log('DEBUG DETAIL BARANG:', response);
                if (response.success && response.data) {
                    const barang = response.data;

                    $('#detailNamaBarang').text(barang.nama_barang || '-');
                    $('#detailKategori').text(barang.kategori || '-');
                    $('#detailLokasi').text(barang.lokasi_barang || '-');
                    $('#detailPemilik').text(barang.nama_karyawan || '-');
                    $('#detailStatus').text(barang.status_barang || '-');
                    $('#detailHarga').text(
                        barang.harga_barang
                            ? barang.harga_barang.toLocaleString('id-ID', {
                                style: 'currency',
                                currency: 'IDR'
                            })
                            : '-'
                    );

                    // ❌ Bagian waktu lelang DIHAPUS

                    $('#detailBarangModal').modal('show');
                } else {
                    toastr.error('Gagal mengambil detail barang: ' + (response.message || 'Data tidak ditemukan'));
                }
            },
            error: function (xhr, status, error) {
                toastr.error('Terjadi kesalahan saat mengambil data barang');
                console.error('AJAX ERROR:', xhr.responseText);
            }
        });
    }


    // function showDetailBarang(id_barang) {
    //     $.ajax({
    //         url: `/barang/detail/${id_barang}`,
    //         type: 'GET',
    //         success: function (response) {
    //             console.log('DEBUG DETAIL BARANG:', response);
    //             if (response.success && response.data) {
    //                 const barang = response.data;
    //                 $('#detailNamaBarang').text(barang.nama_barang || '-');
    //                 $('#detailKategori').text(barang.kategori || '-');
    //                 $('#detailLokasi').text(barang.lokasi_barang || '-');
    //                 $('#detailPemilik').text(barang.nama_karyawan || '-');
    //                 $('#detailStatus').text(barang.status_barang || '-');
    //                 let masaLelang = '-';
    //                 if (barang.waktu_mulai && barang.waktu_selesai) {
    //                     const mulai = new Date(barang.waktu_mulai);
    //                     const selesai = new Date(barang.waktu_selesai);
    //                     masaLelang = mulai.toLocaleString('id-ID') + ' s/d ' + selesai.toLocaleString('id-ID');
    //                 }
    //                 $('#detailMasaLelang').text(masaLelang);
    //                 $('#detailHarga').text(barang.harga_barang ? barang.harga_barang.toLocaleString('id-ID', {style: 'currency', currency: 'IDR'}) : '-');
    //                 $('#detailBarangModal').modal('show');
    //             } else {
    //                 toastr.error('Gagal mengambil detail barang: ' + (response.message || 'Data tidak ditemukan'));
    //             }
    //         },
    //         error: function (xhr, status, error) {
    //             toastr.error('Terjadi kesalahan saat mengambil data barang');
    //             console.error('AJAX ERROR:', xhr.responseText);
    //         }
    //     });
    // }
}
