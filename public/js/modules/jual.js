if (window.location.pathname === "/jual") {

    function changeEntries(value) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('limit', value);
        urlParams.set('page', '1');
        window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
    }
    document.addEventListener('DOMContentLoaded', function () {
        const modalJual = new bootstrap.Modal(document.getElementById('modalJual'), {
            backdrop: 'static'
        });

        const hargaJualInput = new Cleave('#hargaJual', {
            numeral: true,
            numeralThousandsGroupStyle: 'thousand',
            numeralPositiveOnly: true,
            prefix: 'Rp ',
            delimiter: ',',
            numeralDecimalScale: 0,
            rawValueTrimPrefix: true,
            onValueChanged: function (e) {
                const rawValue = e.target.rawValue;
                if (rawValue === '') {
                    this.setRawValue('0');
                }
            }
        });

        const setDefaultDateTime = () => {
            const now = new Date();
            const tanggalInput = document.getElementById('tanggalJual');
            tanggalInput.value = now.toISOString().slice(0, 16);
        };

        window.showJualModal = function (idBarang, hargaDefault) {
            document.getElementById('idBarang').value = idBarang;
            setDefaultDateTime();
            const cleanHarga = hargaDefault.toString().replace(/[^\d]/g, '');
            hargaJualInput.setRawValue(cleanHarga);
            modalJual.show();
        };

        document.getElementById('formJual').addEventListener('submit', async function (e) {
            e.preventDefault();

            const idBarang = document.getElementById('idBarang').value;
            const tanggalJual = document.getElementById('tanggalJual').value;
            const hargaJual = parseInt(hargaJualInput.getRawValue(), 10);

            if (!hargaJual || hargaJual <= 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Harga jual harus lebih besar dari 0'
                });
                return;
            }

            try {
                const response = await fetch('/jual/konfirmasi', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        idBarang,
                        tanggalJual: tanggalJual.replace('T', ' '),
                        hargaJual
                    })
                });

                const result = await response.json();

                if (result.success) {
                    modalJual.hide();
                    await Swal.fire({
                        icon: 'success',
                        title: 'Berhasil!',
                        text: 'Penjualan berhasil dilakukan',
                        showConfirmButton: false,
                        timer: 1500
                    });
                    location.reload();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: error.message || 'Terjadi kesalahan saat menjual'
                });
            }
        });
    });
}