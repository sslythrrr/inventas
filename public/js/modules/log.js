if (window.location.pathname === "/logadmin") {
    document.addEventListener("DOMContentLoaded", function () {
        const rows = document.querySelectorAll("tbody tr");
        rows.forEach(row => {
            const timestampCell = row.querySelector("td:first-child");
            const timestamp = new Date(timestampCell.textContent);
            const options = { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
            timestampCell.textContent = timestamp.toLocaleDateString('id-ID', options).replace(/ /g, '-');
        });
    });

    function changeEntries(value) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('limit', value);
        urlParams.set('page', '1');
        window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
    }
}