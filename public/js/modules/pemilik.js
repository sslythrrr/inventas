async function loadHistori(idBarang) {
    try {
        const response = await fetch(`/pemilik/histori-kepemilikan/${idBarang}`);
        const data = await response.json();

        const tableBody = document.getElementById('historiTableBody');
        tableBody.innerHTML = data.map(item => `
        <tr>
            <td>${new Date(item.tanggal_perolehan).toLocaleDateString('id-ID')}</td>
            <td>${item.nama_karyawan}</td>
            <td>${item.status_kepemilikan}</td>
        </tr>
    `).join('');
    } catch (error) {
        console.error('Error loading history:', error);
    }
}
if (window.location.pathname === "/pemilik") {
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
}

