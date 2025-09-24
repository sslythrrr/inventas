if (window.location.pathname === "/atasan/lelang") {

    $('.konfirmasi-lelang').on('click', function () {
        const idBarang = $(this).data('id');
        const hargaBarang = $(this).data('harga');
        const waktuMulai = $(this).data('waktu-mulai');
        const waktuSelesai = $(this).data('waktu-selesai');

        $('#konfirmasiLelangModal').modal('show');
        $('#idBarangKonfirmasi').val(idBarang);
        $('#modalHargaLelang').text('Rp ' + Number(hargaBarang).toLocaleString());
        $('#modalWaktuMulai').text(waktuMulai ? waktuMulai : '-');
        $('#modalWaktuSelesai').text(waktuSelesai ? waktuSelesai : '-');
    });

    $('#formKonfirmasiLelang').on('submit', function (e) {
        e.preventDefault();

        const idBarang = $('#idBarangKonfirmasi').val();
        $.ajax({
            url: `/atasan/lelang/konfirmasi/${idBarang}`,
            method: 'POST',
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

    $('.batal-lelang').on('click', function () {
        const idBarang = $(this).data('id');
        Swal.fire({
            title: 'Tolak Barang?',
            text: 'Barang akan ditolak dari proses lelang',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Tolak',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: `/atasan/lelang/tolak/${idBarang}`,
                    method: 'POST',
                    success: function (response) {
                        if (response.success) {
                            Swal.fire('Ditolak!', 'Barang berhasil ditolak dari lelang', 'success')
                                .then(() => location.reload());
                        }
                    },
                    error: function () {
                        Swal.fire('Gagal!', 'Terjadi kesalahan saat menolak barang', 'error');
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

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.konfirmasi-lelang').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const idBarang = this.getAttribute('data-id');
                const hargaBarang = this.getAttribute('data-harga');
                document.getElementById('idBarangKonfirmasi').value = idBarang;
                document.getElementById('hargaLelang').value = hargaBarang;
                document.getElementById('waktuMulaiLelang').value = '';
                document.getElementById('waktuSelesaiLelang').value = '';
                const modal = new bootstrap.Modal(document.getElementById('konfirmasiLelangModal'));
                modal.show();
            });
        });

        const form = document.getElementById('formKonfirmasiLelang');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                const idBarang = document.getElementById('idBarangKonfirmasi').value;
                const waktuMulai = document.getElementById('waktuMulaiLelang').value;
                const waktuSelesai = document.getElementById('waktuSelesaiLelang').value;
                const hargaLelang = document.getElementById('hargaLelang').value;
                fetch('/lelang/konfirmasi', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        id_barang: idBarang,
                        waktu_mulai: waktuMulai,
                        waktu_selesai: waktuSelesai,
                        harga_lelang: hargaLelang,
                    }),
                })
                    .then((res) => res.json())
                    .then((data) => {
                        if (data.success) {
                            window.location.reload();
                        } else {
                            alert(data.message || 'Gagal konfirmasi lelang');
                        }
                    })
                    .catch(() => {
                        alert('Terjadi kesalahan saat konfirmasi lelang');
                    });
            });
        }

        // // Handle klik tombol Tolak
        // document.querySelectorAll('.batal-lelang').forEach(function (btn) {
        //     btn.addEventListener('click', function () {
        //         const idBarang = this.getAttribute('data-id');
        //         if (confirm('Yakin ingin menolak barang ini dari lelang?')) {
        //             fetch('/lelang/tolak', {
        //                 method: 'POST',
        //                 headers: {
        //                     'Content-Type': 'application/json',
        //                 },
        //                 body: JSON.stringify({ id_barang: idBarang }),
        //             })
        //                 .then((res) => res.json())
        //                 .then((data) => {
        //                     if (data.success) {
        //                         window.location.reload();
        //                     } else {
        //                         alert(data.message || 'Gagal menolak lelang');
        //                     }
        //                 })
        //                 .catch(() => {
        //                     alert('Terjadi kesalahan saat menolak lelang');
        //                 });
        //         }
        //     });
        // });
    });
}