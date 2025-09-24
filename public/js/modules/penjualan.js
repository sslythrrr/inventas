async function loadDetail(id) {
    try {
        const response = await fetch(`/penjualan/${id}`);
        const data = await response.json();

        if (data.error) {
            alert('Barang tidak ditemukan.');
            return;
        }
        document.getElementById('detailIdPenjualan').innerText = data.id_penjualan;
        document.getElementById('detailIdBarang').innerText = data.id_barang;
        document.getElementById('detailNamaBarang').innerText = data.nama_barang;
        document.getElementById('detailDeskripsi').innerText = data.deskripsi_barang;
        document.getElementById('detailKategori').innerText = data.kategori;
        document.getElementById('detailHargaJual').innerText = `Rp ${data.harga_jual.toLocaleString('id-ID')}`;
        document.getElementById('detailTanggalKeluar').innerText = tanggal.formatDate(data.tanggal_keluar);
        document.getElementById('detailStatusPenjualan').innerText = data.status_penjualan;

        const detailGambar = document.getElementById('detailGambar');
        if (data.gambar_barang) {
            detailGambar.innerHTML = `<img src="data:image/jpeg;base64,${data.gambar_barang}" alt="Gambar Barang" class="img-fluid" style="width: 250px; height: 250px; object-fit: cover;">`;
        } else {
            detailGambar.innerHTML = `<p>Tidak ada gambar</p>`;
        }
    } catch (error) {
        console.error('Error loading detail:', error);
    }
}


const tanggal = {
    formatDate(date) {
        return new Intl.DateTimeFormat('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(new Date(date));
    },
};


if (window.location.pathname === "/penjualan") {
    function changeEntries(value) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('limit', value);
        urlParams.set('page', '1');
        window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
    }

    function sortTable(field, order) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('sort', field);
        urlParams.set('order', order);
        urlParams.set('page', '1');
        window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const paginationLinks = document.querySelectorAll('.pagination .page-link');
        const urlParams = new URLSearchParams(window.location.search);

        paginationLinks.forEach(link => {
            if (link.href && !link.href.includes('#')) {
                const linkUrl = new URL(link.href);
                const linkParams = new URLSearchParams(linkUrl.search);

                if (urlParams.has('sort')) linkParams.set('sort', urlParams.get('sort'));
                if (urlParams.has('order')) linkParams.set('order', urlParams.get('order'));
                if (urlParams.has('limit')) linkParams.set('limit', urlParams.get('limit'));
                if (urlParams.has('search')) linkParams.set('search', urlParams.get('search'));

                link.href = `${linkUrl.pathname}?${linkParams.toString()}`;
            }
        });
    });

    function sortByDate(order) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('sort', 'tanggal_perolehan');
        currentUrl.searchParams.set('order', order);
        window.location.href = currentUrl.toString();
    }

    document.addEventListener('DOMContentLoaded', function () {
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
            printBtn.addEventListener('click', function () {
                printBtn.disabled = true;
                printBtn.textContent = 'Mengunduh...';

                fetch('laporan/printPenjualan')
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
                        a.download = 'INVENTAS_PENJUALAN.xlsx';
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




