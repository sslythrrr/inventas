if (window.location.pathname === "/karyawan") {
    function confirmDeleteK(idKaryawan) {
        Swal.fire({
            title: 'Hapus Karyawan?',
            text: "Data karyawan dan kepemilikan barangnya akan dihapus",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: '/karyawan/delete/' + idKaryawan,
                    type: 'GET',
                    success: function (response) {
                        if (response.success) {
                            Swal.fire(
                                'Terhapus!',
                                'Karyawan berhasil dihapus',
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

    let isDeleteListenerSet = false;

    document.addEventListener('DOMContentLoaded', function () {
        if (typeof jQuery === 'undefined') {
            console.error('jQuery is not loaded');
            return;
        }

        $('#addKaryawanForm').submit(function (event) {
            event.preventDefault();

            // Ambil data form
            const formData = {
                id_karyawan: $('input[name="id_karyawan"]').val(),
                nama_karyawan: $('input[name="nama_karyawan"]').val(),
                jabatan: $('select[name="jabatan"]').val(),
                jenis_kelamin: $('select[name="jenis_kelamin"]').val(),
            };

            // Debug - cek data yang akan dikirim
            console.log('Data yang akan dikirim:', formData);

            $.ajax({
                url: '/karyawan',
                type: 'POST',
                data: formData,
                success: function (response) {
                    if (response.success) {
                        toastr.success('Karyawan berhasil ditambahkan!');
                        $('#addKaryawanModal').modal('hide');
                        $('#addKaryawanForm')[0].reset();
                        updateTable();
                    } else {
                        toastr.error('Gagal menambahkan karyawan: ' + response.message);
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Error:', error);
                    console.error('Response:', xhr.responseText);
                    toastr.error('Terjadi kesalahan: ' + error);
                }
            });
        });

        const CONFIGK = {
            API_ENDPOINTS: {
                DETAIL: (id) => `/karyawan/detail/${id}`,
                EDIT: '/karyawan/edit',
                UPDATE: '/karyawan/edit'
            }
        };

        const Utilskk = {
            formatDate(date) {
                return new Intl.DateTimeFormat('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }).format(new Date(date));
            },

            showError(message) {
                toastr.error(message);
                console.error('Error:', message);
            }
        };

        class KaryawanFormHandler {
            constructor() {
                this.form = $('#editKaryawanForm');
                this.setupEventListeners();
            }

            setupEventListeners() {
                this.form.on('submit', (e) => this.handleSubmit(e));
            }

            async handleSubmit(e) {
                e.preventDefault();

                try {
                    const formData = new FormData(this.form[0]);

                    if (!formData.get('nama_karyawan')) {
                        throw new Error('Nama karyawan harus diisi');
                    }

                    const response = await $.ajax({
                        url: CONFIGK.API_ENDPOINTS.EDIT,
                        type: 'POST',
                        data: formData,
                        processData: false,
                        contentType: false
                    });

                    if (response.success) {
                        toastr.success('Data karyawan berhasil diperbarui!');
                        $('#editKaryawanModal').modal('hide');

                        if (typeof loadKaryawanTable === 'function') {
                            loadKaryawanTable();
                        }
                    } else {
                        throw new Error(response.message || 'Gagal memperbarui data karyawan');
                    }
                } catch (error) {
                    console.error('Error submitting form:', error);
                    Utilskk.showError(error.message);
                }
            }

            populateForm(karyawan) {
                this.form[0].reset();

                $('#editKaryawanModalLabel').text(`Edit Data Karyawan - ${karyawan.nama_karyawan}`);
                $('#id_karyawan').val(karyawan.id_karyawan);
                $('#nama_karyawan').val(karyawan.nama_karyawan);
                $('#jabatan').val(karyawan.jabatan);
                $('#jenis_kelamin').val(karyawan.jenis_kelamin);

            }
        }

        const formHandler = new KaryawanFormHandler();

        $('#editKaryawanForm').on('submit', function (e) {
            e.preventDefault();

            const formData = new FormData(this);
            const submitBtn = $(this).find('button[type="submit"]');
            submitBtn.prop('disabled', true).html('Menyimpan...');

            $.ajax({
                url: '/karyawan/edit',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (response) {
                    if (response.success) {
                        toastr.success('Data karyawan berhasil diperbarui!');
                        $('#editKaryawanModal').modal('hide');
                        updateTable();
                    } else {
                        toastr.error('Gagal memperbarui data karyawan: ' + response.message);
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

        function updateTable() {
            const currentPage = new URLSearchParams(window.location.search).get('page') || 1;

            $.ajax({
                url: `/karyawan/refresh?page=${currentPage}`,
                type: 'GET',
                success: function (response) {
                    if (response.success) {
                        let tableHTML = '';
                        if (response.karyawan.length > 0) {
                            response.karyawan.forEach(item => {
                                tableHTML += `
                                    <tr>
                                        <td class="px-4 py-3 text-center">${item.id_karyawan}</td>
                                        <td>${item.nama_karyawan}</td>
                                        <td>${item.jabatan}</td>
                                        <td class="px-4 py-3 text-center">${item.jenis_kelamin}</td>
                                        <td class="px-4 py-3 text-center">
                                            <div class="btn-group" role="group">
                                                <button class="btn btn-white btn-sm" 
                                                    data-bs-toggle="modal"
                                                    data-bs-target="#editKaryawanModal" 
                                                    title="Edit"
                                                    onclick="getKaryawanDetail('${item.id_karyawan}')">
                                                    <i class="fas fa-ellipsis-v"></i>
                                                </button>
                                                <button class="btn btn-danger btn-sm"
                                                    data-bs-toggle="popup" 
                                                    title="Hapus"
                                                    onclick="confirmDeleteK('${item.id_karyawan}')">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            });
                        } else {
                            tableHTML = '<tr><td colspan="5" class="text-center">Tidak ada data</td></tr>';
                        }

                        $('table tbody').html(tableHTML);

                        // Update info pagination
                        $('#dataTable_info').text(
                            `Menampilkan ${(currentPage - 1) * response.limit + 1} - ${Math.min(currentPage * response.limit, response.totalData)} dari ${response.totalData}`
                        );

                        // Update pagination
                        updatePagination(response.currentPage, response.totalPages);
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Error:', error);
                    toastr.error('Gagal memperbarui tabel');
                }
            });
        }

        $(document).ready(function () {
            updateTable();
        });
    });



    function getKaryawanDetail(id_karyawan) {
        $.ajax({
            url: `/karyawan/detail/${id_karyawan}`,
            type: 'GET',
            success: function (response) {
                if (response.success) {
                    $('#editKaryawanForm')[0].reset();

                    const karyawan = response.data;
                    $('#id_karyawan').val(karyawan.id_karyawan);
                    $('#nama_karyawan').val(karyawan.nama_karyawan);
                    $('#jabatan').val(karyawan.jabatan);
                    $('#jenis_kelamin').val(karyawan.jenis_kelamin);

                    $('#editKaryawanModal').modal('show');
                } else {
                    toastr.error('Gagal mengambil data karyawan: ' + response.message);
                }
            },
            error: function (xhr, status, error) {
                toastr.error('Terjadi kesalahan saat mengambil data karyawan');
            }
        });
    }

    function updateTableRow(item) {
        const row = document.querySelector(`tr[data-id="${item.id_karyawan}"]`);
        if (!row) return;

        row.innerHTML = `
            <td class="px-4 py-3 text-center">${item.id_karyawan}</td>
            <td class="px-4 py-3 text-sm font-medium">${item.nama_karyawan}</td>
            <td class="px-4 py-3 text-sm">${item.jabatan}</td>
            <td class="px-4 py-3 text-sm">${item.jenis_kelamin}</td>
            <td class="px-4 py-3 text-center">
                <div class="btn-group" role="group">
                    <button class="btn btn-white btn-sm" 
                        data-bs-toggle="modal"
                        data-bs-target="#editKaryawanModal"
                        title="Edit"
                        onclick="getKaryawanDetail('${item.id_karyawan}')">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <button class="btn btn-danger btn-sm"
                        data-bs-toggle="popup"
                        title="Hapus"
                        onclick="confirmDeleteK('${item.id_karyawan}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
    }

    function changeEntries(value) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('limit', value);
        urlParams.set('page', '1');
        window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
            printBtn.addEventListener('click', function () {
                printBtn.disabled = true;
                printBtn.textContent = 'Mengunduh...';

                fetch('laporan/printKaryawan')
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
                        a.download = 'INVENTAS_KARYAWAN.xlsx';
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
}