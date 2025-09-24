document.querySelectorAll('.dropdown-toggle').forEach(item => {
    item.addEventListener('click', function () {
        this.nextElementSibling.classList.add('animated', 'fadeIn');
    });
});

async function search() {
    const query = document.getElementById('search-input').value;
    if (query.length === 0) {
        document.getElementById('search-results').innerHTML = '';
        return;
    }

    const response = await fetch(`/search?q=${query}`);
    const results = await response.json();

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    results.forEach(result => {
        const item = document.createElement('div');
        item.classList.add('search-item');
        item.textContent = `${result.name} (${result.source})`;
        item.onclick = () => {
            window.location.href = `/${result.source.toLowerCase()}/${result.id}`;
        };
        resultsContainer.appendChild(item);
    });
}