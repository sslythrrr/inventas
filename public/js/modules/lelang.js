if (window.location.pathname === "/lelang") {
    const hargaLelangInput = new Cleave('#hargaLelang', {
        numeral: true,
        numeralThousandsGroupStyle: 'thousand',
        prefix: 'Rp ',
        numeralPositiveOnly: true
    });

    const hargaLelangEditInput = new Cleave('#hargaLelangEdit', {
        numeral: true,
        numeralThousandsGroupStyle: 'thousand',
        prefix: 'Rp ',
        numeralPositiveOnly: true
    });

    $('.konfirmasi-lelang').on('click', function () {
        const idBarang = $(this).data('id');
        const hargaBarang = $(this).data('harga');

        $('#konfirmasiLelangModal').modal('show');
        $('#idBarangKonfirmasi').val(idBarang);
        hargaLelangInput.setRawValue(hargaBarang);

        const now = new Date();
        const nowFormatted = now.toISOString().slice(0, 16);
        $('#waktuMulaiLelang').attr('min', nowFormatted);
        $('#waktuSelesaiLelang').attr('min', nowFormatted);
    });

    $('#formKonfirmasiLelang').on('submit', function (e) {
        e.preventDefault();

        const idBarang = $('#idBarangKonfirmasi').val();
        const waktuMulai = $('#waktuMulaiLelang').val();
        const waktuSelesai = $('#waktuSelesaiLelang').val();

        const rawValue = hargaLelangInput.getRawValue();
        const cleanValue = rawValue.replace(/[^\d]/g, '');
        const hargaLelang = parseInt(cleanValue, 10);

        if (isNaN(hargaLelang) || hargaLelang <= 0) {
            Swal.fire('Error!', 'Harga lelang tidak valid', 'error');
            return;
        }

        $.ajax({
            url: `lelang/konfirmasi-lelang/${idBarang}`,
            method: 'POST',
            data: {
                waktu_mulai: waktuMulai,
                waktu_selesai: waktuSelesai,
                harga_lelang: hargaLelang
            },
            success: function (response) {
                if (response.success) {
                    $('#konfirmasiLelangModal').modal('hide');
                    Swal.fire('Berhasil!', 'Lelang berhasil dikonfirmasi', 'success')
                        .then(() => location.reload());
                }
            },
            error: function () {
                Swal.fire('Gagal!', 'Terjadi kesalahan saat konfirmasi lelang', 'error');
            }
        });
    });

    $('.edit-lelang').on('click', function () {
        const idBarang = $(this).data('id');
        const currentHarga = $(this).data('harga');
        const waktuSelesai = $(this).data('waktu-selesai');

        $('#editLelangModal').modal('show');
        $('#idLelangEdit').val(idBarang);
        $('#waktuSelesaiEdit').val(waktuSelesai);
        hargaLelangEditInput.setRawValue(currentHarga);

        const now = new Date();
        const nowFormatted = now.toISOString().slice(0, 16);
        $('#waktuSelesaiEdit').attr('min', nowFormatted);
    });

    $('#formEditLelang').on('submit', function (e) {
        e.preventDefault();

        const idBarang = $('#idLelangEdit').val();
        const waktuSelesai = $('#waktuSelesaiEdit').val();

        const rawValue = hargaLelangEditInput.getRawValue();
        const cleanValue = rawValue.replace(/[^\d]/g, '');
        const hargaLelang = parseInt(cleanValue, 10);

        if (isNaN(hargaLelang) || hargaLelang <= 0) {
            Swal.fire('Error!', 'Harga lelang tidak valid', 'error');
            return;
        }

        if (new Date(waktuSelesai) <= new Date()) {
            Swal.fire('Error!', 'Waktu selesai harus lebih besar dari waktu sekarang', 'error');
            return;
        }

        $.ajax({
            url: `lelang/edit-lelang/${idBarang}`,
            method: 'POST',
            data: {
                waktu_selesai: waktuSelesai,
                harga_lelang: hargaLelang
            },
            success: function (response) {
                if (response.success) {
                    $('#editLelangModal').modal('hide');
                    Swal.fire('Berhasil!', 'Lelang berhasil diperbarui', 'success')
                        .then(() => location.reload());
                }
            },
            error: function () {
                Swal.fire('Gagal!', 'Terjadi kesalahan saat memperbarui lelang', 'error');
            }
        });
    });

    $('.selesai-lelang').on('click', function () {
        const idLelang = $(this).data('id');

        Swal.fire({
            title: 'Selesaikan Lelang?',
            text: 'Status barang akan berubah menjadi terlelang',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Selesaikan',
            cancelButtonText: 'Tidak'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: `lelang/selesai-lelang/${idLelang}`,
                    method: 'POST',
                    success: function (response) {
                        if (response.success) {
                            Swal.fire('Berhasil!', 'Lelang selesai', 'success');
                            location.reload();
                        }
                    },
                    error: function () {
                        Swal.fire('Gagal!', 'Terjadi kesalahan', 'error');
                    }
                });
            }
        });
    });

    $('.hapus-lelang').on('click', function () {
        const idLelang = $(this).data('id');

        Swal.fire({
            title: 'Hapus Lelang?',
            text: 'Proses lelang dibatalkan',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Tidak'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: `lelang/hapus-lelang/${idLelang}`,
                    method: 'POST',
                    success: function (response) {
                        if (response.success) {
                            Swal.fire('Berhasil!', 'Lelang dihapus', 'success');
                            location.reload();
                        }
                    },
                    error: function () {
                        Swal.fire('Gagal!', 'Terjadi kesalahan', 'error');
                    }
                });
            }
        });
    });

    $('.batal-lelang').on('click', function () {
        const idLelang = $(this).data('id');

        Swal.fire({
            title: 'Batal Lelang?',
            text: 'Status barang akan kembali tersedia',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, batal',
            cancelButtonText: 'Tidak'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: `lelang/batal-lelang/${idLelang}`,
                    method: 'POST',
                    success: function (response) {
                        if (response.success) {
                            Swal.fire('Berhasil!', 'Lelang dibatal', 'success');
                            location.reload();
                        }
                    },
                    error: function () {
                        Swal.fire('Gagal!', 'Terjadi kesalahan', 'error');
                    }
                });
            }
        });
    });

    function initializeTimers() {
        if (window.timerInterval) {
            clearInterval(window.timerInterval);
        }

        const updateAllTimers = () => {
            const timerElements = document.querySelectorAll('[id^="timer-"]');
            timerElements.forEach(timerEl => {
                const startTimeStr = timerEl.getAttribute('data-start-time');
                const endTimeStr = timerEl.getAttribute('data-end-time');
                if (startTimeStr && endTimeStr) {
                    timerEl.textContent = formatTimeRemaining(startTimeStr, endTimeStr);
                }
            });
        };

        window.timerInterval = setInterval(updateAllTimers, 1000);
        updateAllTimers();
    }

    function formatTimeRemaining(startTimeStr, endTimeStr) {
        const now = new Date();
        const endTime = new Date(endTimeStr);
        const timeLeft = endTime - now;

        if (timeLeft <= 0) {
            return 'Waktu Habis';
        }

        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        return `${days}h${hours}j${minutes}m${seconds}d`;
    }

    initializeTimers();
}